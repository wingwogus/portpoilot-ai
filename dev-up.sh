#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$ROOT_DIR/web"
API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-3000}"

cleanup() {
  echo ""
  echo "[dev-up] Shutting down..."
  [[ -n "${API_PID:-}" ]] && kill "$API_PID" 2>/dev/null || true
  [[ -n "${WEB_PID:-}" ]] && kill "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[dev-up] Root: $ROOT_DIR"
echo "[dev-up] API:  http://localhost:${API_PORT}"
echo "[dev-up] Web:  http://localhost:${WEB_PORT}"

if [[ ! -d "$WEB_DIR/node_modules" ]]; then
  echo "[dev-up] Installing web dependencies..."
  (cd "$WEB_DIR" && npm install)
fi

echo "[dev-up] Starting FastAPI..."
(
  cd "$ROOT_DIR"
  python3 -m uvicorn main:app --reload --port "$API_PORT"
) &
API_PID=$!

echo "[dev-up] Starting Next.js..."
(
  cd "$WEB_DIR"
  npm run dev -- -p "$WEB_PORT"
) &
WEB_PID=$!

echo "[dev-up] Running (Ctrl+C to stop both)"
wait -n "$API_PID" "$WEB_PID"

echo "[dev-up] One process exited. Stopping the other..."
exit 1
