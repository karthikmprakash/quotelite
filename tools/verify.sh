#!/usr/bin/env bash
# Whole-suite gate. Run this before declaring any phase complete.
# Exits non-zero if ANY available check fails. Adaptive: runs what exists.
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
FAIL=0
run(){ echo; echo "=== $* ==="; if eval "$*"; then echo "[PASS] $*"; else echo "[FAIL] $*"; FAIL=1; fi; }

echo "project: $ROOT"

# --- stack checks (run only what is present) ---
if [ -f package.json ]; then
  [ -f package-lock.json ] || [ -f pnpm-lock.yaml ] || [ -f yarn.lock ] || run "npm install --no-audit --no-fund"
  node -e "const p=require('./package.json').scripts||{};process.exit(p.build?0:1)" \
    && run "npm run build"
  node -e "const p=require('./package.json').scripts||{};process.exit(p.test?0:1)" \
    && run "npm test -- --ci --silent"
  node -e "const p=require('./package.json').scripts||{};process.exit(p.typecheck?0:1)" \
    && run "npm run typecheck"
  node -e "const p=require('./package.json').scripts||{};process.exit(p.lint?0:1)" \
    && run "npm run lint"
fi
if [ -f pyproject.toml ] || [ -f requirements.txt ]; then
  [ -d .venv ] && run ". .venv/bin/activate && python -m pytest -q" || run "python3 -m pytest -q"
fi

# --- replica skill tooling (only if the artefacts exist) ---
[ -f replica/design/tokens.json ] && [ -f "$ROOT/.claude/skills/replica-design/contrast.py" ] \
  && run "python3 .claude/skills/replica-design/contrast.py replica/design/tokens.json"

# --- secrets gate: no live keys committed ---
if git rev-parse --git-dir >/dev/null 2>&1; then
  LEAK=$(git grep -nE "sk_live_|AKIA[0-9A-Z]{16}|-----BEGIN (RSA|OPENSSH|PRIVATE)" -- . 2>/dev/null | head -5)
  if [ -n "$LEAK" ]; then echo "[FAIL] possible committed secret:"; echo "$LEAK"; FAIL=1; else echo "[PASS] no obvious committed secrets"; fi
fi

# --- status gate ---
echo
python3 tools/status.py || true
echo
if [ "$FAIL" -ne 0 ]; then echo "GATE: FAILED — fix the above before continuing."; exit 1; fi
echo "GATE: all available checks passed."
