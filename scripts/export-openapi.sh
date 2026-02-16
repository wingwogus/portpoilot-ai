#!/usr/bin/env bash
set -euo pipefail

OUT_PATH="${1:-reports/openapi.snapshot.json}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
mkdir -p "$(dirname "$OUT_PATH")"

"$PYTHON_BIN" - <<'PY' "$OUT_PATH"
import json
import sys

out_path = sys.argv[1]

try:
    from main import app
except ModuleNotFoundError as e:
    missing = e.name or "dependency"
    raise SystemExit(
        f"[fail] cannot export OpenAPI: missing python module '{missing}'. "
        "Install project dependencies first (e.g. `python3 -m pip install -r requirements.txt`) "
        "or set PYTHON_BIN to a prepared interpreter."
    )

spec = app.openapi()
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(spec, f, ensure_ascii=False, indent=2)

print(f"[ok] wrote OpenAPI snapshot: {out_path}")
PY
