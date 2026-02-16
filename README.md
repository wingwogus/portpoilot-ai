# PortPilot AI - FastAPI Prototype (Reason MVP)

Lightweight FastAPI backend prototype with:

- Existing legacy endpoints (market briefing / portfolio generation)
- New Reason MVP checkup workflow endpoints under `/api/v1`
- In-memory data store + deterministic mock responses
- Async job simulation for checkup generation

> No Spring. No DB required for this prototype.

---

## Run

### Backend only
```bash
cd /home/node/.openclaw/workspace/portpoilot-ai
python3 -m uvicorn main:app --reload --port 8000
```

### Frontend + Backend together (recommended)
```bash
cd /home/node/.openclaw/workspace/portpoilot-ai
./dev-up.sh
```

Open:
- Frontend: `http://localhost:3000`
- API docs: `http://localhost:8000/docs`

Open API docs:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## API Summary

## Legacy (kept for compatibility)

### `GET /market-briefing`
Returns daily market briefing data.

### `POST /generate-portfolio`
Generates a mock ETF portfolio from survey input.

Request example:
```json
{
  "age": 32,
  "seed_money": 30000,
  "risk_tolerance": "중립",
  "goal": "장기 자산 증식"
}
```

---

## Reason MVP Endpoints

### 1) `POST /api/v1/checkups`
Creates a checkup request and starts async mock analysis job.

Request example:
```json
{
  "product_name": "Reason",
  "service_url": "https://example.com",
  "target_user": "초기 스타트업 PM",
  "goal": "온보딩 전환율 개선",
  "notes": "모바일 유입 비중 높음"
}
```

Response example:
```json
{
  "checkup_id": "chk_0001",
  "job_id": "job_0001",
  "status": "PENDING"
}
```

---

### 2) `GET /api/v1/jobs/{jobId}`
Checks async job status.

Status lifecycle:
- `PENDING`
- `RUNNING`
- `COMPLETED`
- `FAILED` (reserved)

Response example:
```json
{
  "job_id": "job_0001",
  "status": "COMPLETED",
  "checkup_id": "chk_0001",
  "created_at": "2026-02-16T10:00:00Z",
  "updated_at": "2026-02-16T10:00:02Z",
  "result": {
    "checkup_id": "chk_0001",
    "overall_score": 74,
    "verdict": "Promising"
  },
  "error": null
}
```

---

### 3) `GET /api/v1/checkups/{checkupId}`
Gets full checkup report.

- Before completion: status `PENDING` with empty findings
- After completion: deterministic findings and recommendations

---

### 4) `POST /api/v1/checkups/{checkupId}/recompose`
Recomposes (re-generates) a completed checkup with optional focus.

Request example:
```json
{
  "focus": "onboarding"
}
```

Behavior:
- Increments `recomposed_version`
- Deterministically updates scores/content using same seeded logic pattern

---

### 5) `POST /api/v1/checkups/{checkupId}/briefings`
Creates a concise briefing from completed checkup.

Request example:
```json
{
  "audience": "executive",
  "tone": "actionable"
}
```

Supported tones:
- `neutral`
- `actionable`
- `concise`

---

## Prototype Design Notes

- Storage is **in-memory only** (`CHECKUPS`, `JOBS`) and resets on server restart.
- Job processing is simulated with async background task (`~1.2s`).
- Checkup scoring is deterministic using SHA-256 seed from request + version.
- This is intended for MVP API contract validation and frontend integration.

---

## Quick Test Flow (curl)

```bash
# 1) create checkup
curl -s -X POST http://localhost:8000/api/v1/checkups \
  -H 'Content-Type: application/json' \
  -d '{"product_name":"Reason","target_user":"PM","goal":"onboarding 개선"}'

# 2) poll job
curl -s http://localhost:8000/api/v1/jobs/job_0001

# 3) get checkup
curl -s http://localhost:8000/api/v1/checkups/chk_0001

# 4) recompose
curl -s -X POST http://localhost:8000/api/v1/checkups/chk_0001/recompose \
  -H 'Content-Type: application/json' \
  -d '{"focus":"conversion"}'

# 5) briefing
curl -s -X POST http://localhost:8000/api/v1/checkups/chk_0001/briefings \
  -H 'Content-Type: application/json' \
  -d '{"audience":"team","tone":"concise"}'
```
