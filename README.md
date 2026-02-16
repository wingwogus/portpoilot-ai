# PortPilot AI - FastAPI Prototype (Reason MVP)

Lightweight FastAPI backend prototype with:

- Legacy endpoints (`/market-briefing`, `/generate-portfolio`) 유지
- Reason MVP endpoints under `/api/v1`
- In-memory data store + deterministic mock responses
- Async job simulation for checkup generation

---

## Run

### Backend only
```bash
cd /home/node/.openclaw/workspace/portpoilot-ai
python3 -m uvicorn main:app --reload --port 8000
```

### Frontend + Backend together
```bash
cd /home/node/.openclaw/workspace/portpoilot-ai
./dev-up.sh
```

Open:
- Frontend: `http://localhost:3000`
- Swagger: `http://localhost:8000/docs`

---

## FE 실연동 안정화 포인트

### 1) CORS 허용
로컬 Next.js 연동을 위해 아래 origin 허용:
- `http://localhost:3000`
- `http://127.0.0.1:3000`

### 2) `/api/v1` 공통 응답 필드 계약
`/api/v1` 계열 응답은 아래 키를 **항상 포함**합니다.

- `job_id` (없으면 `null` 가능)
- `checkup_id`
- `status`
- `result` (없으면 `null` 가능)

즉, FE는 공통적으로 다음 형태를 기준 파싱하면 됩니다:

```json
{
  "job_id": "job_0001",
  "checkup_id": "chk_0001",
  "status": "COMPLETED",
  "result": {}
}
```

> 레거시 endpoint(`/market-briefing`, `/generate-portfolio`)는 기존 스키마를 그대로 유지합니다.

---

## API Summary

## Legacy (호환 유지)

### `GET /market-briefing`
Daily market briefing 반환.

### `POST /generate-portfolio`
기존 설문 기반 포트폴리오 반환.

---

## Reason MVP (`/api/v1`)

### 1) `POST /api/v1/checkups`
체크업 생성 + 비동기 job 시작.

요청 예시:
```json
{
  "product_name": "Reason",
  "service_url": "https://example.com",
  "target_user": "초기 스타트업 PM",
  "goal": "온보딩 전환율 개선",
  "notes": "모바일 유입 비중 높음"
}
```

응답 예시:
```json
{
  "checkup_id": "chk_0001",
  "job_id": "job_0001",
  "status": "PENDING",
  "result": null
}
```

### 2) `GET /api/v1/jobs/{job_id}`
비동기 작업 상태 확인.

응답 예시:
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

### 3) `GET /api/v1/checkups/{checkup_id}`
체크업 상세 조회.

응답 예시(완료 후):
```json
{
  "checkup_id": "chk_0001",
  "job_id": "job_0001",
  "status": "COMPLETED",
  "result": {
    "overall_score": 74,
    "verdict": "Promising",
    "top_areas": ["Value Proposition", "Onboarding Flow", "Trust & Credibility"],
    "next_actions": ["...", "...", "..."]
  },
  "created_at": "2026-02-16T10:00:00Z",
  "updated_at": "2026-02-16T10:00:02Z",
  "request": {"product_name": "Reason", "service_url": null, "target_user": "PM", "goal": "onboarding 개선", "notes": null},
  "overall_score": 74,
  "verdict": "Promising",
  "findings": [],
  "next_actions": [],
  "recomposed_version": 1
}
```

### 4) `POST /api/v1/checkups/{checkup_id}/recompose`
focus 기반으로 결과 재구성. FE에서는 `result`와 `recomposed_version`을 같이 사용하면 버전 관리가 쉬움.

요청:
```json
{ "focus": "onboarding" }
```

응답 구조:
- 공통 필드: `job_id/checkup_id/status/result`
- 상세 필드: 기존 checkup 상세와 동일 (`findings`, `next_actions`, `recomposed_version` 등)

### 5) `POST /api/v1/checkups/{checkup_id}/briefings`
체크업 결과를 요약 브리핑으로 변환.

요청:
```json
{ "audience": "executive", "tone": "actionable" }
```

응답(FE friendly):
```json
{
  "checkup_id": "chk_0001",
  "job_id": "job_0001",
  "status": "COMPLETED",
  "result": {
    "audience": "executive",
    "tone": "actionable",
    "headline": "Reason checkup: Promising (74/100)",
    "summary": "...",
    "bullets": ["...", "...", "..."],
    "score": 74,
    "verdict": "Promising",
    "top_issues": ["Value Proposition", "Onboarding Flow", "Trust & Credibility"]
  },
  "audience": "executive",
  "tone": "actionable",
  "headline": "Reason checkup: Promising (74/100)",
  "summary": "...",
  "bullets": ["...", "...", "..."]
}
```

`result`만 사용해도 렌더링 가능하도록 payload를 중복 제공했습니다.

---

## 실제 연동용 curl 예시

```bash
# 0) CORS preflight 확인 (브라우저와 동일한 Origin)
curl -i -X OPTIONS 'http://localhost:8000/api/v1/checkups' \
  -H 'Origin: http://localhost:3000' \
  -H 'Access-Control-Request-Method: POST'

# 1) checkup 생성
curl -s -X POST 'http://localhost:8000/api/v1/checkups' \
  -H 'Content-Type: application/json' \
  -d '{
    "product_name":"Reason",
    "target_user":"PM",
    "goal":"onboarding 개선"
  }'

# 2) job 상태 조회
curl -s 'http://localhost:8000/api/v1/jobs/job_0001'

# 3) checkup 상세 조회
curl -s 'http://localhost:8000/api/v1/checkups/chk_0001'

# 4) recompose
curl -s -X POST 'http://localhost:8000/api/v1/checkups/chk_0001/recompose' \
  -H 'Content-Type: application/json' \
  -d '{"focus":"conversion"}'

# 5) briefings
curl -s -X POST 'http://localhost:8000/api/v1/checkups/chk_0001/briefings' \
  -H 'Content-Type: application/json' \
  -d '{"audience":"team","tone":"concise"}'
```

---

## Self-test

간단 검증 스크립트:

```bash
cd /home/node/.openclaw/workspace/portpoilot-ai
bash scripts/self-test.sh
```

검증 항목:
1. CORS 헤더 (`Access-Control-Allow-Origin`) 존재
2. `/api/v1/checkups` 공통 필드 (`job_id/checkup_id/status/result`) 확인
3. `/api/v1/jobs/{job_id}` 동작 확인
4. `/api/v1/checkups/{checkup_id}` 공통 필드 확인
5. `/recompose`, `/briefings` 공통 필드 및 FE-friendly `result` 확인
6. 레거시 endpoint (`/market-briefing`, `/generate-portfolio`) 호환 확인
