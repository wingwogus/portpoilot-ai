#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3}"

echo "[preflight] ROOT_DIR=$ROOT_DIR"
echo "[preflight] PYTHON_BIN=$PYTHON_BIN"

fail_count=0

check_cmd() {
  local desc="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "[ok] $desc"
  else
    echo "[fail] $desc"
    fail_count=$((fail_count + 1))
  fi
}

check_py_module() {
  local module="$1"
  local desc="$2"
  if "$PYTHON_BIN" - <<PY >/dev/null 2>&1
import importlib
importlib.import_module("$module")
PY
  then
    echo "[ok] $desc"
  else
    echo "[fail] $desc"
    fail_count=$((fail_count + 1))
  fi
}

check_cmd "python executable available" command -v "$PYTHON_BIN"
check_py_module "venv" "python module 'venv' available"
check_py_module "ensurepip" "python module 'ensurepip' available"
check_py_module "pip" "python module 'pip' available"
check_py_module "fastapi" "python module 'fastapi' available"
check_py_module "uvicorn" "python module 'uvicorn' available"

if [[ $fail_count -gt 0 ]]; then
  echo
  echo "[summary] preflight failed: $fail_count check(s)"
  cat <<'EOT'
[guide] Next actions (pick what your environment supports):
  1) Install venv/pip at OS level (Ubuntu example)
     sudo apt-get update && sudo apt-get install -y python3-pip python3.11-venv

  2) Create project venv and install deps
     python3 -m venv .venv
     ./.venv/bin/python -m pip install -r requirements.txt

  3) Start server for smoke/self-test
     USE_MOCK_OLLAMA=true ./.venv/bin/python -m uvicorn main:app --port 8000

  4) Re-run checks
     ./scripts/runtime-preflight.sh
     ./scripts/self-test.sh
EOT
  exit 1
fi

echo
echo "✅ runtime preflight passed"
