#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MAIN_PY="$ROOT_DIR/main.py"
MODELS_PY="$ROOT_DIR/models.py"

python3 - <<'PY' "$MAIN_PY" "$MODELS_PY"
import ast
import sys
from pathlib import Path

main_path = Path(sys.argv[1])
models_path = Path(sys.argv[2])

main_code = main_path.read_text(encoding="utf-8")
models_code = models_path.read_text(encoding="utf-8")

# 1) Endpoint contract: required routes must exist in main.py decorators.
required_routes = {
    ("get", "/market-briefing"),
    ("post", "/generate-portfolio"),
    ("post", "/api/v1/checkups"),
    ("get", "/api/v1/jobs/{job_id}"),
    ("get", "/api/v1/checkups/{checkup_id}"),
    ("post", "/api/v1/checkups/{checkup_id}/recompose"),
    ("post", "/api/v1/checkups/{checkup_id}/briefings"),
    ("get", "/etf-news"),
    ("get", "/etf-news/index-status"),
}

tree = ast.parse(main_code)
found_routes = set()
for node in ast.walk(tree):
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
        method = node.func.attr.lower()
        if method in {"get", "post", "put", "delete", "patch"} and node.args:
            first = node.args[0]
            if isinstance(first, ast.Constant) and isinstance(first.value, str):
                found_routes.add((method, first.value))

missing_routes = sorted(required_routes - found_routes)
if missing_routes:
    raise SystemExit(f"[fail] missing routes: {missing_routes}")

# 2) Schema contract: key fields required by FE/consumers.
module = ast.parse(models_code)
class_fields = {}
for node in module.body:
    if isinstance(node, ast.ClassDef):
        fields = set()
        for item in node.body:
            if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                fields.add(item.target.id)
        class_fields[node.name] = fields

required_fields = {
    "ETFNewsItem": {"source_link", "summary", "signal", "evidence", "score_explain"},
    "ETFNewsResponse": {"count", "items", "query_expansion_terms"},
    "ETFNewsIndexStatusResponse": {"indexed_docs", "cache_ttl_seconds", "embed_dim", "cached_queries", "provider"},
}

for cls, expected in required_fields.items():
    actual = class_fields.get(cls)
    if actual is None:
        raise SystemExit(f"[fail] missing model class: {cls}")
    miss = sorted(expected - actual)
    if miss:
        raise SystemExit(f"[fail] missing fields in {cls}: {miss}")

# 3) Error envelope / observability contract (static assertions in main.py)
required_main_snippets = [
    '"error_type": "validation_error"',
    '"error_type": "http_error"',
    '"request_id": request_id',
    'response.headers["X-Request-ID"]',
    'response.headers["X-Process-Time-Ms"]',
    'status_class',
]
for snippet in required_main_snippets:
    if snippet not in main_code:
        raise SystemExit(f"[fail] missing main.py contract snippet: {snippet}")

print("[ok] endpoint contract routes")
print("[ok] response model contract fields")
print("[ok] error envelope/observability contract")
print("✅ contract-lint passed")
PY
