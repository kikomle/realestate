#!/usr/bin/env bash
# Idempotent setup for the infra owned by agent E:
#   - Playwright Chromium (user cache, not the project)
#   - OpenCode version check
#   - scripts/doctor.sh
# Safe to re-run. Does not use sudo, does not modify the global OpenCode config.
set -eu

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PW_TOOLS="$HOME/.local/share/playwright-cli-tools"
PW_PKG_VERSION="0.1.25"
PW_BIN="$PW_TOOLS/node_modules/.bin/playwright"

echo "[1/3] Playwright CLI and Chromium"
if [ ! -x "$PW_BIN" ]; then
  mkdir -p "$PW_TOOLS"
  npm install --prefix "$PW_TOOLS" "@playwright/cli@$PW_PKG_VERSION" >/dev/null
fi
if ls "$HOME"/Library/Caches/ms-playwright/chromium-* >/dev/null 2>&1; then
  echo "  chromium already installed"
else
  "$PW_BIN" install chromium
fi

echo "[2/3] OpenCode version"
OC="$HOME/.opencode/bin/opencode"
if [ -x "$OC" ]; then
  echo "  $("$OC" --version | tail -1)"
else
  echo "  OpenCode not found at $OC (install per docs/runbook.md)"
fi

echo "[3/3] Doctor"
scripts/doctor.sh
