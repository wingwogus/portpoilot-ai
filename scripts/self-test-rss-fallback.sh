#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PORT="${PORT:-8010}"
BASE_URL="${BASE_URL:-http://127.0.0.1:${PORT}}"
SERVER_LOG="${SERVER_LOG:-/tmp/portpilot-rss-fallback.log}"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "[self-test-rss-fallback] start server with broken RSS feed"
ETF_NEWS_PROVIDER=rss \
ETF_NEWS_RSS_URLS="http://127.0.0.1:9/unreachable.xml" \
USE_MOCK_OLLAMA=true \
python3 -m uvicorn main:app --port "$PORT" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

for i in {1..30}; do
  if curl -fsS "${BASE_URL}/market-briefing" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

python3 - <<'PY'
import json, os, urllib.request

base = os.getenv("BASE_URL", "http://127.0.0.1:8010")
with urllib.request.urlopen(base + "/etf-news/index-status", timeout=10) as r:
    data = json.loads(r.read().decode("utf-8"))

provider = data.get("provider")
provider_detail = data.get("provider_detail")
indexed_docs = data.get("indexed_docs", 0)

assert provider == "json_file", f"expected provider=json_file fallback, got {provider!r}"
assert isinstance(provider_detail, str) and "fallback_from_rss" in provider_detail, (
    f"expected provider_detail fallback marker, got {provider_detail!r}"
)
assert indexed_docs >= 1, f"expected fallback docs to be indexed, got {indexed_docs}"
print("[ok] rss fallback provider status")
PY

echo "✅ self-test-rss-fallback passed"