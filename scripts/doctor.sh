#!/usr/bin/env bash
# Health check for the realestate2 project. Prints PASS / WARN / FAIL per item.
# Exits non-zero if any item FAILs. Use --ci to skip machine-specific checks.
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 2

CI=0
for arg in "$@"; do
  case "$arg" in
    --ci) CI=1 ;;
    -h|--help)
      echo "usage: scripts/doctor.sh [--ci]"
      exit 0
      ;;
  esac
done

PASS=0
WARN=0
FAIL=0

pass() { PASS=$((PASS + 1)); printf 'PASS  %s\n' "$1"; }
warn() { WARN=$((WARN + 1)); printf 'WARN  %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf 'FAIL  %s\n' "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }

echo "== realestate2 doctor (ci=$CI) =="

# --- Toolchain -------------------------------------------------------------
if have node; then
  NODE_MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
  if [ "$NODE_MAJOR" -ge 22 ] 2>/dev/null; then pass "node $(node -v) (>= 22)"; else fail "node $(node -v) is older than 22"; fi
else
  fail "node not found"
fi

if have npm; then pass "npm $(npm -v)"; else fail "npm not found"; fi

if have ffmpeg && have ffprobe; then
  pass "ffmpeg/ffprobe present ($(ffmpeg -version 2>/dev/null | head -1 | awk '{print $3}'))"
elif [ "$CI" -eq 1 ]; then
  warn "ffmpeg/ffprobe check skipped (--ci)"
else
  fail "ffmpeg/ffprobe not found"
fi

if have pdfinfo; then pass "poppler pdfinfo present"; else warn "pdfinfo not found (install poppler for PDF tooling)"; fi

if have python3.12; then
  pass "python3.12 present ($(python3.12 --version 2>&1))"
else
  fail "python3.12 not found"
fi

if [ -x ".venv/bin/python" ]; then
  pass ".venv present ($(.venv/bin/python --version 2>&1))"
else
  warn ".venv not yet set up"
fi

if [ "$CI" -eq 1 ]; then
  warn "local BIM environment check skipped (--ci)"
elif [ -x ".venv-bim/bin/python" ]; then
  pass ".venv-bim present ($(.venv-bim/bin/python --version 2>&1))"
else
  fail ".venv-bim missing"
fi

# --- OpenCode --------------------------------------------------------------
OPENCODE_BIN="$HOME/.opencode/bin/opencode"
if [ "$CI" -eq 1 ]; then
  warn "local OpenCode runtime check skipped (--ci)"
elif [ -x "$OPENCODE_BIN" ]; then
  pass "OpenCode $("$OPENCODE_BIN" --version 2>/dev/null | tail -1)"
else
  fail "OpenCode not found at $OPENCODE_BIN"
fi

# --- Blender (machine-specific) --------------------------------------------
if [ "$CI" -eq 1 ]; then
  warn "Blender check skipped (--ci)"
else
  if [ -d "/Applications/Blender.app" ]; then
    BLENDER_VER="$(/Applications/Blender.app/Contents/MacOS/Blender --version 2>/dev/null | head -1)"
    pass "Blender at /Applications/Blender.app (${BLENDER_VER:-version unknown})"
  else
    fail "Blender.app not found at /Applications/Blender.app"
  fi
fi

# --- opencode.jsonc ---------------------------------------------------------
if [ -f "opencode.jsonc" ]; then
  if python3 - <<'PY' >/tmp/doctor_jsonc.$$ 2>&1
import json, re, sys
src = open("opencode.jsonc", encoding="utf-8").read()
# Strip // and /* */ comments outside of strings, and trailing commas.
out, i, n, in_str = [], 0, len(src), False
while i < n:
    c = src[i]
    if in_str:
        out.append(c)
        if c == "\\" and i + 1 < n:
            out.append(src[i + 1]); i += 2; continue
        if c == '"': in_str = False
        i += 1; continue
    if c == '"':
        in_str = True; out.append(c); i += 1; continue
    if src.startswith("//", i):
        while i < n and src[i] != "\n": i += 1
        continue
    if src.startswith("/*", i):
        j = src.find("*/", i + 2); i = n if j < 0 else j + 2
        continue
    out.append(c); i += 1
text = re.sub(r",(\s*[}\]])", r"\1", "".join(out))
cfg = json.loads(text)
mcp = cfg.get("mcp", {})
servers = mcp.get("servers", mcp) if isinstance(mcp, dict) else {}
for name, s in servers.items():
    if not isinstance(s, dict) or "command" not in s:
        continue
    if s.get("type") == "remote" or s.get("disabled"):
        continue
    print(f"MCP {name}: " + json.dumps(s["command"][0]))
PY
  then
    pass "opencode.jsonc parses (comments stripped)"
    while IFS= read -r line; do
      case "$line" in
        MCP\ *)
          name="${line#MCP }"; name="${name%%:*}"
          cmd="$(python3 -c "import sys,json; print(json.loads(sys.stdin.read().split(': ',1)[1]))" <<<"$line" 2>/dev/null)"
          if [ -n "$cmd" ] && { [ -x "$cmd" ] || have "$cmd"; }; then
            pass "MCP $name command exists: $cmd"
          elif [ "$CI" -eq 1 ]; then
            warn "local MCP $name runtime check skipped (--ci)"
          else
            fail "MCP $name command not found: $cmd"
          fi
          ;;
      esac
    done < <(grep '^MCP ' /tmp/doctor_jsonc.$$)
  else
    fail "opencode.jsonc does not parse: $(head -c 300 /tmp/doctor_jsonc.$$)"
  fi
  rm -f /tmp/doctor_jsonc.$$
else
  warn "opencode.jsonc not yet created (orchestrator owns it)"
fi

# --- Agents and skills ------------------------------------------------------
if [ -d ".opencode/agents" ] && [ -n "$(ls .opencode/agents/*.md 2>/dev/null)" ]; then
  AGENT_COUNT=$(ls .opencode/agents/*.md | wc -l | tr -d ' ')
  BAD=0
  for f in .opencode/agents/*.md; do
    head -1 "$f" | grep -q '^---$' || BAD=$((BAD + 1))
    grep -q '^description:' "$f" || BAD=$((BAD + 1))
  done
  if [ "$BAD" -eq 0 ]; then pass "$AGENT_COUNT project agents with frontmatter"; else fail "$BAD agent frontmatter problem(s) in .opencode/agents"; fi
else
  fail ".opencode/agents has no agent files"
fi

SKILL_BAD=0
SKILL_COUNT=0
for d in .opencode/skills/*/; do
  [ -d "$d" ] || continue
  SKILL_COUNT=$((SKILL_COUNT + 1))
  f="${d}SKILL.md"
  if [ ! -f "$f" ]; then SKILL_BAD=$((SKILL_BAD + 1)); continue; fi
  grep -q '^name:' "$f" || SKILL_BAD=$((SKILL_BAD + 1))
  grep -q '^description:' "$f" || SKILL_BAD=$((SKILL_BAD + 1))
done
if [ "$SKILL_COUNT" -eq 0 ]; then
  fail "no project skills in .opencode/skills"
elif [ "$SKILL_BAD" -eq 0 ]; then
  pass "$SKILL_COUNT project skills with SKILL.md name+description"
else
  fail "$SKILL_BAD skill(s) missing SKILL.md or name/description"
fi

# --- Next.js app --------------------------------------------------------------
if [ -f "package.json" ]; then
  for s in dev build lint; do
    if python3 -c "import json,sys; sys.exit(0 if '$s' in json.load(open('package.json')).get('scripts',{}) else 1)"; then
      pass "package.json script: $s"
    else
      fail "package.json script missing: $s"
    fi
  done
  if python3 -c "import json,sys; sys.exit(0 if 'test' in json.load(open('package.json')).get('scripts',{}) else 1)"; then
    pass "package.json script: test"
  else
    warn "package.json script 'test' not yet added (pending agent C fragment)"
  fi
  if [ -d "node_modules" ]; then pass "node_modules present"; else warn "node_modules not installed (run npm ci)"; fi
else
  fail "package.json missing"
fi

if ls public/models/test/*.glb >/dev/null 2>&1; then
  pass "GLB test assets in public/models/test"
else
  warn "no GLB test assets in public/models/test yet"
fi

# --- HyperFrames -----------------------------------------------------------
if [ "$CI" -eq 1 ]; then
  warn "HyperFrames check skipped (--ci)"
else
  if have npx && npx --no-install hyperframes --version >/dev/null 2>&1; then
    pass "HyperFrames CLI reachable"
  elif [ -d "$HOME/.config/opencode/skills/hyperframes" ]; then
    warn "HyperFrames skill installed, CLI not reachable via npx (agent B pending)"
  else
    warn "HyperFrames not set up yet"
  fi
fi

# --- Playwright (machine-specific) ----------------------------------------
if [ "$CI" -eq 1 ]; then
  warn "Playwright browser check skipped (--ci)"
else
  if ls "$HOME"/Library/Caches/ms-playwright/chromium-*/ >/dev/null 2>&1 || ls "$HOME"/Library/Caches/ms-playwright/chromium_headless_shell-*/ >/dev/null 2>&1; then
    pass "Playwright Chromium present in ~/Library/Caches/ms-playwright"
  else
    fail "Playwright Chromium not installed (run scripts/setup-infra.sh)"
  fi
fi

if [ -f "playwright.config.ts" ]; then pass "playwright.config.ts present"; else fail "playwright.config.ts missing"; fi

# --- Geometry schema & assets inventory ------------------------------------
if [ -f "assets/geometry/schema/geometry.schema.json" ] || ls assets/geometry/schema/*.schema.json >/dev/null 2>&1; then
  pass "geometry schema file present"
else
  warn "geometry schema not yet present (GATE 2/3 pending)"
fi

if [ -d "assets/source" ]; then
  if [ -f "assets/source/INVENTORY.md" ] || [ -f "assets/source/mocire-zadar-h/inventory.json" ]; then
    pass "assets/source inventory present"
  else
    warn "assets/source exists but no inventory yet (GATE 2 pending)"
  fi
else
  warn "assets/source not yet created (GATE 2 pending)"
fi

echo
echo "== summary: $PASS PASS, $WARN WARN, $FAIL FAIL =="
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
