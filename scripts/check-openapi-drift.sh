#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SNAPSHOT_PATH="${1:-$ROOT_DIR/reports/openapi.snapshot.json}"
TMP_PATH="$(mktemp)"
trap 'rm -f "$TMP_PATH"' EXIT

if [[ ! -f "$SNAPSHOT_PATH" ]]; then
  echo "[fail] snapshot not found: $SNAPSHOT_PATH"
  echo "       create it first: bash scripts/export-openapi.sh $SNAPSHOT_PATH"
  exit 1
fi

bash "$ROOT_DIR/scripts/export-openapi.sh" "$TMP_PATH" >/dev/null

python3 - <<'PY' "$SNAPSHOT_PATH" "$TMP_PATH"
import json
import sys
from pathlib import Path

snapshot_path = Path(sys.argv[1])
current_path = Path(sys.argv[2])

snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
current = json.loads(current_path.read_text(encoding="utf-8"))

if snapshot != current:
    print("[fail] OpenAPI drift detected.")
    print("       refresh snapshot: bash scripts/export-openapi.sh", snapshot_path)
    sys.exit(1)

print("[ok] OpenAPI snapshot is up to date")
PY
