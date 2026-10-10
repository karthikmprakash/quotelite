#!/usr/bin/env bash
# Whole-suite gate. Run before declaring any phase complete.
#   ./tools/verify.sh            -> every available check must pass
#   ./tools/verify.sh --strict   -> additionally requires zero features pending
# Exits non-zero on any failure. Adaptive: only runs what exists.
set -uo pipefail
cd "$(dirname "$0")/.."
STRICT=0; [ "${1:-}" = "--strict" ] && STRICT=1
FAIL=0
run(){ echo; echo "=== $* ==="; if eval "$*"; then echo "[PASS]"; else echo "[FAIL] $*"; FAIL=1; fi; }

echo "project: $PWD"

# --- stack checks (only what is present) ---
if [ -f package.json ]; then
  if [ ! -d node_modules ]; then run "npm install --no-audit --no-fund"; fi
  for s in build test typecheck lint; do
    if node -e "const p=(require('./package.json').scripts||{});process.exit(p['$s']?0:1)" 2>/dev/null; then
      run "npm run $s"
    fi
  done
fi
if [ -f pyproject.toml ] || [ -f requirements.txt ]; then
  if [ -d .venv ]; then run ". .venv/bin/activate && python -m pytest -q"; else run "python3 -m pytest -q"; fi
fi

# --- replica skill tooling, when the artefact exists ---
if [ -f replica/design/tokens.json ] && [ -f .claude/skills/replica-design/contrast.py ]; then
  run "python3 .claude/skills/replica-design/contrast.py replica/design/tokens.json"
fi

# --- secrets gate (excludes this scanner, which contains the patterns) ---
if git rev-parse --git-dir >/dev/null 2>&1; then
  LEAK=$(git grep -nE "sk_live_|AKIA[0-9A-Z]{16}|-----BEGIN (RSA|OPENSSH|PRIVATE)" -- . ':(exclude)tools/verify.sh' 2>/dev/null | head -5)
  if [ -n "$LEAK" ]; then echo "[FAIL] possible committed secret:"; echo "$LEAK"; FAIL=1; else echo "[PASS] no obvious committed secrets"; fi
  if git ls-files --error-unmatch .env .env.local >/dev/null 2>&1; then echo "[FAIL] .env is tracked by git"; FAIL=1; else echo "[PASS] .env not tracked"; fi
fi

# --- feature status ---
echo
if python3 tools/status.py; then PENDING=0; else PENDING=1; fi

if [ "$STRICT" -eq 1 ] && [ "$PENDING" -ne 0 ]; then
  echo "[FAIL] strict: features still pending"; FAIL=1
fi

echo
if [ "$FAIL" -ne 0 ]; then echo "GATE: FAILED — fix the above before continuing."; exit 1; fi
if [ "$PENDING" -ne 0 ]; then echo "GATE: checks pass. Features still pending — keep looping."; exit 0; fi
echo "GATE: ALL PASS — every available check green, no features pending."
