#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$ROOT_DIR/web"
API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-3000}"

API_PID=""
WEB_PID=""

cleanup() {
  echo ""
  echo "[dev-up] Shutting down..."
  [[ -n "$API_PID" ]] && kill "$API_PID" 2>/dev/null || true
  [[ -n "$WEB_PID" ]] && kill "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

port_in_use() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$port" -sTCP:LISTEN -n -P >/dev/null 2>&1
    return $?
  fi
  return 1
}

echo "[dev-up] Root: $ROOT_DIR"
echo "[dev-up] API:  http://localhost:${API_PORT}"
echo "[dev-up] Web:  http://localhost:${WEB_PORT}"

if port_in_use "$API_PORT"; then
  echo "[dev-up] ERROR: API 포트(${API_PORT})가 이미 사용 중입니다."
  echo "[dev-up] 확인: lsof -i :${API_PORT}"
  exit 1
fi

if port_in_use "$WEB_PORT"; then
  echo "[dev-up] ERROR: WEB 포트(${WEB_PORT})가 이미 사용 중입니다."
  echo "[dev-up] 확인: lsof -i :${WEB_PORT}"
  exit 1
fi

if [[ ! -d "$WEB_DIR/node_modules" ]]; then
  echo "[dev-up] Installing web dependencies..."
  (cd "$WEB_DIR" && npm install)
fi

python_has_uvicorn() {
  local pybin="$1"
  "$pybin" -c "import uvicorn" >/dev/null 2>&1
}

PYTHON_BIN="python3"
if [[ -n "${VIRTUAL_ENV:-}" && -x "${VIRTUAL_ENV}/bin/python" ]]; then
  CANDIDATE="${VIRTUAL_ENV}/bin/python"
  if python_has_uvicorn "$CANDIDATE"; then
    PYTHON_BIN="$CANDIDATE"
    echo "[dev-up] Using active venv python: $PYTHON_BIN"
  else
    echo "[dev-up] active venv에 uvicorn이 없습니다. fallback 탐색 중..."
  fi
fi

if [[ "$PYTHON_BIN" == "python3" && -x "$ROOT_DIR/.venv/bin/python" ]]; then
  CANDIDATE="$ROOT_DIR/.venv/bin/python"
  if python_has_uvicorn "$CANDIDATE"; then
    PYTHON_BIN="$CANDIDATE"
    echo "[dev-up] Using project .venv python: $PYTHON_BIN"
  fi
fi

if [[ "$PYTHON_BIN" == "python3" && -x "$ROOT_DIR/venv/bin/python" ]]; then
  CANDIDATE="$ROOT_DIR/venv/bin/python"
  if python_has_uvicorn "$CANDIDATE"; then
    PYTHON_BIN="$CANDIDATE"
    echo "[dev-up] Using project venv python: $PYTHON_BIN"
  fi
fi

if [[ "$PYTHON_BIN" == "python3" ]]; then
  if ! python_has_uvicorn "$PYTHON_BIN"; then
    echo "[dev-up] ERROR: 사용할 python 환경에 uvicorn이 없습니다."
    echo "[dev-up] 해결: venv 활성화 후 'pip install -r requirements.txt' 또는 'pip install uvicorn fastapi'"
    exit 1
  fi
  echo "[dev-up] venv 미사용 또는 미구성. system python3 사용"
fi

USE_MOCK_OLLAMA="${USE_MOCK_OLLAMA:-false}"
echo "[dev-up] USE_MOCK_OLLAMA=$USE_MOCK_OLLAMA"

echo "[dev-up] Starting FastAPI..."
(
  cd "$ROOT_DIR"
  USE_MOCK_OLLAMA="$USE_MOCK_OLLAMA" "$PYTHON_BIN" -m uvicorn main:app --reload --port "$API_PORT"
) &
API_PID=$!

echo "[dev-up] Starting Next.js..."
(
  cd "$WEB_DIR"
  npm run dev -- -p "$WEB_PORT"
) &
WEB_PID=$!

echo "[dev-up] Running (Ctrl+C to stop both)"

# macOS 기본 bash(3.x) 호환: wait -n 대신 폴링
while true; do
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "[dev-up] FastAPI exited. Stopping Next.js..."
    kill "$WEB_PID" 2>/dev/null || true
    wait "$WEB_PID" 2>/dev/null || true
    exit 1
  fi

  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    echo "[dev-up] Next.js exited. Stopping FastAPI..."
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
    exit 1
  fi

  sleep 1
done
