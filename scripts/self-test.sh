#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "[self-test] BASE_URL=$BASE_URL"

python3 - <<'PY'
import os, sys, json, time, urllib.request, urllib.error

BASE = os.getenv("BASE_URL", "http://localhost:8000")

def req(method, path, data=None, headers=None):
    url = BASE + path
    payload = None if data is None else json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=payload, method=method)
    for k,v in (headers or {}).items():
        req.add_header(k,v)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            body = r.read().decode("utf-8")
            headers = {k.lower(): v for k, v in r.getheaders()}
            return r.status, headers, body
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8") if e.fp else ""
        headers = {k.lower(): v for k, v in (e.headers.items() if e.headers else [])}
        return e.code, headers, body
    except urllib.error.URLError as e:
        raise AssertionError(
            "server not reachable. start backend first: "
            "`USE_MOCK_OLLAMA=true python3 -m uvicorn main:app --port 8000` "
            "(or install FastAPI deps if missing)"
        ) from e

def jloads(s):
    return json.loads(s)

# 0) CORS preflight
status, hdrs, _ = req("OPTIONS", "/api/v1/checkups", headers={
    "Origin": "http://localhost:3000",
    "Access-Control-Request-Method": "POST",
})
assert status in (200, 204), f"preflight status={status}"
aco = hdrs.get("access-control-allow-origin")
assert aco in ("http://localhost:3000", "*"), f"allow-origin missing: {aco}"
print("[ok] CORS preflight")

# 1) create checkup
status, hdrs, body = req("POST", "/api/v1/checkups", data={
    "product_name":"Reason",
    "target_user":"PM",
    "goal":"onboarding 개선"
}, headers={"Content-Type":"application/json", "X-Request-ID": "selftest-checkups-001"})
assert status == 200, f"checkups status={status}"
assert hdrs.get("x-request-id") == "selftest-checkups-001", "x-request-id echo mismatch"
assert hdrs.get("x-process-time-ms") is not None, "x-process-time-ms missing"
create = jloads(body)
for k in ("job_id","checkup_id","status","result"):
    assert k in create, f"missing key in create: {k}"
job_id = create["job_id"]
checkup_id = create["checkup_id"]
print("[ok] create checkup common keys")

# 2) wait job complete
for _ in range(10):
    status, _, body = req("GET", f"/api/v1/jobs/{job_id}")
    assert status == 200, f"job status={status}"
    job = jloads(body)
    if job.get("status") == "COMPLETED":
        break
    time.sleep(0.4)
else:
    raise AssertionError("job did not complete in time")
print("[ok] job completed")

# 3) checkup detail common keys
status, _, body = req("GET", f"/api/v1/checkups/{checkup_id}")
assert status == 200, f"checkup status={status}"
checkup = jloads(body)
for k in ("job_id","checkup_id","status","result"):
    assert k in checkup, f"missing key in checkup: {k}"
print("[ok] checkup common keys")

# 4) recompose
status, _, body = req("POST", f"/api/v1/checkups/{checkup_id}/recompose", data={"focus":"conversion"}, headers={"Content-Type":"application/json"})
assert status == 200, f"recompose status={status}"
recompose = jloads(body)
for k in ("job_id","checkup_id","status","result"):
    assert k in recompose, f"missing key in recompose: {k}"
print("[ok] recompose common keys")

# 5) briefing
status, _, body = req("POST", f"/api/v1/checkups/{checkup_id}/briefings", data={"audience":"team","tone":"concise"}, headers={"Content-Type":"application/json"})
assert status == 200, f"briefing status={status}"
briefing = jloads(body)
for k in ("job_id","checkup_id","status","result"):
    assert k in briefing, f"missing key in briefing: {k}"
assert isinstance(briefing["result"], dict) and "bullets" in briefing["result"], "briefing result payload invalid"
print("[ok] briefing common keys + FE payload")

# 6) ETF 뉴스 RAG 검색 흐름
status, _, body = req("GET", "/etf-news?tickers=QQQ,SCHD&limit=5")
assert status == 200, f"etf-news status={status}"
news = jloads(body)
assert news.get("count", 0) > 0, "etf-news should return at least one document"
assert isinstance(news.get("query_expansion_terms"), list), "query_expansion_terms should be list"
first = news["items"][0]
for k in ("source_link", "summary", "signal", "evidence", "score_explain"):
    assert k in first, f"missing key in etf-news item: {k}"
assert first["signal"] in ("bullish", "bearish", "neutral"), f"invalid signal: {first['signal']}"
assert isinstance(first["evidence"], list) and len(first["evidence"]) > 0, "evidence should be non-empty"
print("[ok] etf-news rag retrieval + fields")

# 7) ETF 뉴스 인덱스 상태 확인
status, _, body = req("GET", "/etf-news/index-status")
assert status == 200, f"index-status status={status}"
idx = jloads(body)
for k in ("indexed_docs", "cache_ttl_seconds", "embed_dim", "cached_queries", "provider"):
    assert k in idx, f"missing key in index-status: {k}"
assert idx["indexed_docs"] >= 1, "indexed_docs should be >= 1"
assert idx["provider"] in ("json_file", "rss"), f"unexpected provider: {idx.get('provider')}"
print("[ok] etf-news index-status + provider")

# 8) core endpoint /generate-portfolio + source (ollama 미연결 환경 허용)
status, _, body = req("POST", "/generate-portfolio", data={
    "age":32,
    "seed_money":30000000,
    "risk_tolerance":"중립",
    "goal":"장기 자산 증식"
}, headers={"Content-Type":"application/json"})
if status == 200:
    portfolio = jloads(body)
    assert portfolio.get("source") == "ollama", f"invalid source={portfolio.get('source')}"
    print("[ok] generate-portfolio + source")
elif status == 503:
    err = jloads(body)
    detail = str(err.get("detail") or err.get("error") or "")
    assert ("Ollama" in detail) or ("Mock" in detail), f"unexpected 503 detail: {detail}"
    print("[ok] generate-portfolio endpoint reachable (ollama unavailable in current env)")
else:
    raise AssertionError(f"generate-portfolio unexpected status={status}, body={body}")

# 9) validation error envelope
status, hdrs, body = req("POST", "/generate-portfolio", data={
    "age":15,
    "seed_money":50000,
    "risk_tolerance":"invalid",
    "goal":"x"
}, headers={"Content-Type":"application/json", "X-Request-ID": "selftest-validation-001"})
assert status == 422, f"validation status={status}"
assert hdrs.get("x-request-id") == "selftest-validation-001", "validation x-request-id echo mismatch"
err = jloads(body)
assert err.get("error_type") == "validation_error", f"validation error_type missing: {err}"
assert isinstance(err.get("details"), list) and len(err["details"]) > 0, "validation details missing"
assert err.get("request_id") == "selftest-validation-001", "validation request_id mismatch"
print("[ok] validation error envelope")

# 10) not-found error envelope
status, _, body = req("GET", "/api/v1/jobs/job_not_found")
assert status == 404, f"not-found status={status}"
err = jloads(body)
assert err.get("error_type") == "http_error", f"http error_type missing: {err}"
assert isinstance(err.get("request_id"), str) and len(err["request_id"]) > 0, "http_error request_id missing"
print("[ok] not-found error envelope")

# 11) supplemental endpoint /market-briefing
status, _, _ = req("GET", "/market-briefing")
assert status == 200, f"market-briefing status={status}"
print("[ok] market-briefing")

print("\n✅ self-test passed")
PY
