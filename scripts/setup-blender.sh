#!/usr/bin/env bash
# Idempotent Blender-side setup for realestate2. Safe to re-run.
# Steps: check Blender -> .venv-bim -> pinned requirements -> glTF tools -> smoke test.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BLENDER="${BLENDER_BIN:-/Applications/Blender.app/Contents/MacOS/Blender}"
PY_SYS="${PYTHON_SYS:-/Library/Frameworks/Python.framework/Versions/3.12/bin/python3}"
VENV="$ROOT/.venv-bim"
SMOKE=1
[[ "${1:-}" == "--no-smoke" ]] && SMOKE=0

log() { printf '[setup-blender] %s\n' "$*"; }
die() { printf '[setup-blender] ERROR: %s\n' "$*" >&2; exit 1; }

# 1. Blender
[[ -x "$BLENDER" ]] || die "Blender not found at $BLENDER (set BLENDER_BIN)"
VER="$("$BLENDER" -b --factory-startup --python-expr 'import bpy; print("BVER=" + bpy.app.version_string)' 2>/dev/null | sed -n 's/^BVER=//p' | head -1)"
[[ -n "$VER" ]] || die "Blender did not report a version"
case "$VER" in 5.*) log "Blender $VER OK" ;; *) die "Blender $VER is not 5.x; the pipeline is tested on 5.3" ;;
esac

# 2. venv
if [[ ! -x "$VENV/bin/python" ]]; then
  log "creating $VENV"
  "$PY_SYS" -m venv "$VENV"
fi

# 3. pinned requirements (idempotent: pip is a no-op when satisfied)
"$VENV/bin/python" -m pip install -q --upgrade pip
"$VENV/bin/python" -m pip install -q -r "$ROOT/scripts/blender/requirements.txt"
log "python requirements OK ($("$VENV/bin/python" -c 'import ifcopenshell; print("ifcopenshell " + ifcopenshell.version)'))"

# 4. glTF tools (pinned in scripts/blender/node_tools/package.json)
if [[ ! -d "$ROOT/scripts/blender/node_tools/node_modules/@gltf-transform/cli" ]]; then
  (cd "$ROOT/scripts/blender/node_tools" && npm ci --silent 2>/dev/null || npm install --silent)
fi
log "gltf-transform $("$ROOT/scripts/blender/node_tools/node_modules/.bin/gltf-transform" --version | tail -1)"

# 5. smoke test
if [[ "$SMOKE" == 1 ]]; then
  OUT="$ROOT/scripts/blender/out"
  mkdir -p "$OUT" "$ROOT/assets/blender/renders/smoke" "$ROOT/public/models/test"
  "$BLENDER" -b --factory-startup --python "$ROOT/scripts/blender/build_test_complex.py" -- --out "$OUT/test_complex.blend"
  "$BLENDER" -b --factory-startup "$OUT/test_complex.blend" --python "$ROOT/scripts/blender/export_glb.py" -- --glb "$OUT/test_complex.glb" --manifest "$OUT/test_complex.manifest.json"
  "$ROOT/scripts/blender/node_tools/node_modules/.bin/gltf-transform" optimize "$OUT/test_complex.glb" "$OUT/test_complex.opt.glb" \
    --compress meshopt --flatten false --join false --instance false --simplify false --texture-compress false >/dev/null
  "$BLENDER" -b --factory-startup "$OUT/test_complex.blend" --python "$ROOT/scripts/blender/render.py" -- \
    --camera CAM_aerial --out "$ROOT/assets/blender/renders/smoke/aerial.png" --samples 32 --res-x 960 --res-y 540
  cp "$OUT/test_complex.opt.glb" "$ROOT/public/models/test/smoke-complex.glb"
  cp "$OUT/test_complex.manifest.json" "$ROOT/public/models/test/smoke-complex.manifest.json"
  "$VENV/bin/python" "$ROOT/scripts/blender/verify_scene.py" \
    --glb "$ROOT/public/models/test/smoke-complex.glb" --manifest "$ROOT/public/models/test/smoke-complex.manifest.json"
  log "smoke test OK"
fi
