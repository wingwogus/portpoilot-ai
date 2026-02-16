#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PORT="${PORT:-8000}"
BASE_URL="${BASE_URL:-http://127.0.0.1:${PORT}}"
SERVER_LOG="${SERVER_LOG:-/tmp/portpilot-live-gate.log}"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "[quality-gate-live] 1/3 static quality gate"
bash scripts/quality-gate.sh

echo "[quality-gate-live] 2/3 start api server (mock ollama)"
USE_MOCK_OLLAMA=true python3 -m uvicorn main:app --port "$PORT" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

for i in {1..30}; do
  if curl -fsS "${BASE_URL}/market-briefing" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

if ! curl -fsS "${BASE_URL}/market-briefing" >/dev/null 2>&1; then
  echo "[fail] api server did not become ready. check: $SERVER_LOG"
  exit 1
fi

echo "[quality-gate-live] 3/3 run self-test"
BASE_URL="$BASE_URL" bash scripts/self-test.sh

echo "✅ quality-gate-live passed"