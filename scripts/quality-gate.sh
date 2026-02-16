#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "[quality-gate] 1/3 contract-lint"
bash scripts/contract-lint.sh

echo "[quality-gate] 2/3 openapi drift"
bash scripts/check-openapi-drift.sh reports/openapi.snapshot.json

echo "[quality-gate] 3/3 py_compile"
python3 -m py_compile main.py models.py services.py etf_news_rag.py

echo "✅ quality-gate passed"
