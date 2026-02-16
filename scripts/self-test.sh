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
status, _, body = req("POST", "/api/v1/checkups", data={
    "product_name":"Reason",
    "target_user":"PM",
    "goal":"onboarding 개선"
}, headers={"Content-Type":"application/json"})
assert status == 200, f"checkups status={status}"
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
first = news["items"][0]
for k in ("source_link", "summary", "signal", "evidence"):
    assert k in first, f"missing key in etf-news item: {k}"
assert first["signal"] in ("bullish", "bearish", "neutral"), f"invalid signal: {first['signal']}"
assert isinstance(first["evidence"], list) and len(first["evidence"]) > 0, "evidence should be non-empty"
print("[ok] etf-news rag retrieval + fields")

# 7) core endpoint /generate-portfolio + source (ollama 미연결 환경 허용)
status, _, body = req("POST", "/generate-portfolio", data={
    "age":32,
    "seed_money":30000000,
    "risk_tolerance":"중립",
    "goal":"장기 자산 증식"
}, headers={"Content-Type":"application/json"})
if status == 200:
    portfolio = jloads(body)
    assert portfolio.get("source") in ("mock", "ollama"), f"invalid source={portfolio.get('source')}"
    print("[ok] generate-portfolio + source")
elif status == 503:
    err = jloads(body)
    detail = str(err.get("detail", ""))
    assert ("Ollama" in detail) or ("Mock" in detail), f"unexpected 503 detail: {detail}"
    print("[ok] generate-portfolio endpoint reachable (ollama unavailable in current env)")
else:
    raise AssertionError(f"generate-portfolio unexpected status={status}, body={body}")

# 8) supplemental endpoint /market-briefing
status, _, _ = req("GET", "/market-briefing")
assert status == 200, f"market-briefing status={status}"
print("[ok] market-briefing")

print("\n✅ self-test passed")
PY
