# PortPilot AI - FastAPI (ETF Recommendation + ETF 뉴스 RAG)

사용자 성향 기반 ETF 추천 API(`/generate-portfolio`)와
내장 VectorDB 기반 ETF 뉴스 RAG API(`/etf-news`)와
사건/인과 기반 ETF 의사결정 RAG API(`/etf-decision-brief`)를 제공하는 백엔드입니다.
기존 `/market-briefing`, `/api/v1/checkups`는 유지됩니다.

프론트엔드(`web/`)는 아래를 포함한 ETF RAG MVP 화면을 제공합니다.
- 홈 대시보드(`/`): 섹터별 핫뉴스 카드 + ETF별 뉴스 카드
- 홈 데이터 스키마: `data/fundmanage-home-feed.schema.json` (FundManage 에이전트 연동 기준)
- 의사결정 브리프 전용(`/decision-brief`): 티커 직접 입력 조회
- 설문/포트폴리오(`/survey`, `/portfolio-result`): `/generate-portfolio` 연동

---

## 핵심 변경사항

1. `/generate-portfolio` 입력 검증 강화
   - `age`: 19~100
   - `seed_money`: 100,000 ~ 10,000,000,000
   - `risk_tolerance`: `보수적 | 중립 | 공격적` (별칭 `보수/중립형/공격` 허용)
   - `goal`: 2~200자
2. 내장 VectorDB 기반 ETF 뉴스 RAG 1차 구현
   - 뉴스 수집/정규화 파이프라인: `data/etf_news_ko.json` 로드 후 정규화 (한국어 전용)
   - 임베딩 저장: 해시 기반 임베딩(192-dim) 생성 후 메모리 VectorDB 인덱싱
   - 메타태그 저장: `tickers`, `sectors` 태그와 함께 검색
   - ETF별 검색 API 추가: `GET /etf-news?tickers=QQQ,SCHD`
   - 응답 필드: `source_link`, `summary`, `signal`, `evidence`, `sector_tags`, `ticker_hits`, `score_explain`
   - 최근 뉴스 우선 로직: 시간 기반 recency boost + TTL 캐시(기본 5분)
3. 에러 메시지 개선
   - FastAPI validation 에러를 `field/message` 구조로 반환
4. CORS 유지
   - `http://localhost:3000`, `http://127.0.0.1:3000`

---

## 실행

```bash
cd /home/node/.openclaw/workspace/portpoilot-ai
# 1) 의존성 설치
python3 -m pip install -r requirements.txt

# 2) 서버 실행
python3 -m uvicorn main:app --reload --port 8000
```

> pip/venv가 없는 환경이면(예: `No module named pip`, `ensurepip unavailable`) 먼저 시스템 패키지(`python3-pip`, `python3-venv`)를 설치해야 합니다.

### 환경변수

```bash
# 기본값: false (실 Ollama 경로)
export USE_MOCK_OLLAMA=false

# ETF 뉴스 데이터 소스 경로 (기본: sample json)
# 외부 수집 파이프라인 산출물로 교체 가능
export ETF_NEWS_DATA_PATH=data/etf_news_ko.json

# ETF 뉴스 provider 선택: json_file | rss
export ETF_NEWS_PROVIDER=json_file

# rss provider 사용 시 피드 URL 목록(콤마 구분)
export ETF_NEWS_RSS_URLS="https://feeds.reuters.com/reuters/businessNews,https://feeds.reuters.com/news/wealth"

# ETF 의사결정 RAG 입력 데이터 경로
export ETF_DECISION_RAW_DIR=/home/node/.openclaw/workspace/research-data/raw
export ETF_DECISION_BRIEF_DIR=/home/node/.openclaw/workspace/research-data/brief
```

> `ETF_NEWS_PROVIDER=rss` 사용 시 RSS 인덱싱 실패가 나면 자동으로 `json_file`로 폴백하며,
> `/etf-news/index-status`의 `provider_detail`에 `json_file(fallback_from_rss)`가 기록됩니다.

> 정책상 `/generate-portfolio` Mock 응답은 비활성화되어 있습니다.
> Ollama/LangChain 의존성과 모델(`gemma2:9b`)이 준비되어 있어야 합니다.

---

## API

## 1) Core: `POST /generate-portfolio`

요청 예시:

```json
{
  "age": 32,
  "seed_money": 30000000,
  "risk_tolerance": "중립",
  "goal": "장기 자산 증식"
}
```

성공 응답 예시:

```json
{
  "market_analysis": "...",
  "summary_comment": "...",
  "items": [
    {"ticker":"VOO","summary":"S&P500 추종","ratio":40,"reason":"기본 시장 노출"},
    {"ticker":"SCHD","summary":"배당 성장","ratio":25,"reason":"현금흐름 안정성"},
    {"ticker":"QQQ","summary":"기술 성장","ratio":15,"reason":"장기 성장성 보완"},
    {"ticker":"TLT","summary":"미 장기채","ratio":20,"reason":"방어력 보강"}
  ],
  "source": "ollama"
}
```

### 검증 에러 예시(422)

```json
{
  "error": "입력값 검증에 실패했습니다.",
  "error_type": "validation_error",
  "details": [
    {"field":"age","message":"Input should be greater than or equal to 19"}
  ],
  "request_id": "b34f..."
}
```

## 2) ETF 뉴스 RAG: `GET /etf-news?tickers=QQQ,SCHD`

쿼리 파라미터:
- `tickers` (필수): 쉼표 구분 ETF 티커
- `limit` (선택, 기본 8, 최대 20)
- `prefer_recent_hours` (선택, 기본 96)

응답 예시:

```json
{
  "query_tickers": ["QQQ", "SCHD"],
  "query_expansion_terms": ["nasdaq", "big tech", "dividend", "quality"],
  "count": 5,
  "cached": false,
  "items": [
    {
      "doc_id": "n001",
      "title": "Nvidia earnings beat drives AI rally across Nasdaq",
      "source_link": "https://example.com/news/nvidia-earnings-ai-rally",
      "published_at": "2026-02-16T06:30:00Z",
      "summary": "Nvidia posted another earnings beat...",
      "signal": "bullish",
      "evidence": ["Nvidia posted another earnings beat..."],
      "ticker_hits": ["QQQ"],
      "sector_tags": ["Information Technology", "Semiconductors"],
      "score": 0.7421,
      "score_explain": "semantic=0.410(55%), ticker=0.300(30%), recency=0.105(15%)"
    }
  ]
}
```

## 3) ETF 뉴스 인덱스 상태: `GET /etf-news/index-status`

응답 예시:

```json
{
  "indexed_docs": 24,
  "cache_ttl_seconds": 300,
  "embed_dim": 192,
  "cached_queries": 3,
  "provider": "json_file",
  "provider_detail": null,
  "built_at": "2026-02-16T13:40:00Z",
  "data_path": "data/etf_news_ko.json",
  "error": null
}
```

## 4) ETF 의사결정 브리프: `GET /etf-decision-brief?tickers=QQQ,SPY,XLE,SMH`

쿼리 파라미터:
- `tickers` (필수): 쉼표 구분 ETF 티커
- `limit_per_ticker` (선택, 기본 5, 최대 10)

응답 특징:
- 티커별 `bullish/neutral/bearish` 신호
- `conclusion`, `causal_summary`, `key_events`, `evidence`, `risk_invalidation_conditions`
- 증거(evidence)에 `source_link` 포함 (출처 보존)

## 5) ETF 의사결정 인덱스 상태: `GET /etf-decision-brief/index-status`

응답 특징:
- `archives_by_date`: 날짜별 인덱싱 문서 수
- `latest_loaded`: raw/brief의 latest 동시 처리 여부

## 6) 부가 기능: `GET /market-briefing`
- 기존 endpoint 유지

## 7) Reason MVP: `/api/v1/*`
- 기존 체크업 관련 endpoint 유지

---

## curl 예시

```bash
# 0) CORS preflight
curl -i -X OPTIONS 'http://localhost:8000/generate-portfolio' \
  -H 'Origin: http://localhost:3000' \
  -H 'Access-Control-Request-Method: POST'

# 1) 기본 성공 요청 (source 확인)
curl -s -X POST 'http://localhost:8000/generate-portfolio' \
  -H 'Content-Type: application/json' \
  -d '{
    "age":32,
    "seed_money":30000000,
    "risk_tolerance":"중립",
    "goal":"장기 자산 증식"
  }'

# 2) 잘못된 입력(검증 에러)
curl -s -X POST 'http://localhost:8000/generate-portfolio' \
  -H 'Content-Type: application/json' \
  -d '{
    "age":15,
    "seed_money":50000,
    "risk_tolerance":"아무거나",
    "goal":"x"
  }'

# 3) ETF 뉴스 RAG 검색
curl -s 'http://localhost:8000/etf-news?tickers=QQQ,SCHD&limit=5'

# 4) ETF 뉴스 인덱스 상태
curl -s 'http://localhost:8000/etf-news/index-status'

# 5) 레거시/부가 기능 유지 확인
curl -s 'http://localhost:8000/market-briefing'
```

---

## 관측성(Observability)

- 모든 응답 헤더에 `X-Request-ID`, `X-Process-Time-Ms`를 포함합니다.
- `X-Request-ID`를 요청에 넣으면 그대로 전달되어 추적 상관관계(correlation)에 활용할 수 있습니다.
- 에러 응답 본문에는 `error_type`, `request_id`가 포함됩니다.
- 서버 로그(`portpilot.api`)에는 `request_completed` 이벤트로 `status_code/status_class/duration_ms`가 기록됩니다.

## OpenAPI 스냅샷

```bash
cd /home/node/.openclaw/workspace/portpoilot-ai
bash scripts/export-openapi.sh
# 또는 원하는 경로 지정
bash scripts/export-openapi.sh reports/openapi.snapshot.json
# 또는 준비된 인터프리터 지정
PYTHON_BIN=.venv/bin/python bash scripts/export-openapi.sh
```

> 실행 환경에 `fastapi`가 설치되어 있어야 합니다. 미설치 시 스크립트가 원인과 조치 방법을 안내합니다.

### OpenAPI 드리프트 점검

스냅샷과 현재 스키마를 비교해 계약 변경 누락을 탐지합니다.

```bash
cd /home/node/.openclaw/workspace/portpoilot-ai
bash scripts/check-openapi-drift.sh
# 또는 스냅샷 경로 지정
bash scripts/check-openapi-drift.sh reports/openapi.snapshot.json
```

## 외부 뉴스 파이프라인 연동

### A) JSON 인입 (기존 방식)

외부 수집 결과(JSON array)를 RAG 입력 스키마로 정규화:

```bash
cd /home/node/.openclaw/workspace/portpoilot-ai
python3 scripts/ingest-news-json.py \
  --input /path/to/raw_news.json \
  --output data/ingested_etf_news.json

# 앱에서 신규 데이터 사용
export ETF_NEWS_DATA_PATH=data/ingested_etf_news.json
```

### B) RSS 실시간 인입 (선행 P2)

파일 적재 없이 RSS 피드에서 직접 인덱스를 구성할 수 있습니다.

```bash
cd /home/node/.openclaw/workspace/portpoilot-ai
export ETF_NEWS_PROVIDER=rss
export ETF_NEWS_RSS_URLS="https://feeds.reuters.com/reuters/businessNews,https://feeds.reuters.com/news/wealth"
python3 -m uvicorn main:app --reload --port 8000
```

> 참고: RSS 본문은 피드 설명(description) 중심으로 수집되며, 티커/섹터 태그는 키워드 기반 휴리스틱으로 추출됩니다.

## Runtime preflight (환경 진단)

`pip/venv/fastapi` 누락 여부를 먼저 확인하려면:

```bash
cd /home/node/.openclaw/workspace/portpoilot-ai
bash scripts/runtime-preflight.sh
```

실패 시 즉시 실행 가능한 조치 가이드를 출력합니다.

## Contract lint (정적 계약 점검)

서버 미기동/의존성 미설치 환경에서도 API 핵심 계약을 빠르게 확인합니다.

```bash
cd /home/node/.openclaw/workspace/portpoilot-ai
bash scripts/contract-lint.sh
```

## Quality gate (정적 품질 게이트)

커밋 전 최소 게이트(`contract-lint + openapi drift + py_compile`)를 한 번에 점검합니다.

```bash
cd /home/node/.openclaw/workspace/portpoilot-ai
bash scripts/quality-gate.sh
```

검증 항목:
- 필수 엔드포인트 라우트 존재 여부 (`/generate-portfolio`, `/etf-news`, `/etf-news/index-status`, `/api/v1/*`)
- 핵심 응답 스키마 필드 존재 여부 (`score_explain`, `query_expansion_terms` 등)
- 에러/관측성 계약 존재 여부 (`error_type`, `request_id`, `X-Request-ID`, `X-Process-Time-Ms`, `status_class`)

## Quality gate (실주행 포함)

정적 게이트 + 서버 기동 + self-test까지 한 번에 점검합니다.

```bash
cd /home/node/.openclaw/workspace/portpoilot-ai
bash scripts/quality-gate-live.sh
```

기본 동작:
1. `quality-gate.sh` 실행
2. `USE_MOCK_OLLAMA=true`로 uvicorn 임시 기동
3. `self-test.sh` 실행 후 서버 자동 정리

## Self-test

권장 순서: `runtime-preflight` 통과 → 서버 실행 → self-test 실행

서버 실행 후:

```bash
cd /home/node/.openclaw/workspace/portpoilot-ai
bash scripts/self-test.sh
```

검증 항목:
1. CORS preflight
2. `/api/v1` checkup 생성/완료/조회/recompose/briefing
3. 관측성 헤더 검증 (`X-Request-ID` echo, `X-Process-Time-Ms`)
4. `/etf-news?tickers=QQQ,SCHD` 실제 검색 흐름 동작
5. ETF 뉴스 응답에 `source_link/summary/signal/evidence/score_explain/query_expansion_terms` 포함
6. `/etf-news/index-status` 상태 응답 검증
7. `/generate-portfolio` 기본 요청 검증 (`source` 확인 또는 Ollama 미연결 503 확인)
8. 에러 응답 envelope 검증 (`error_type`, `request_id`)
9. `/market-briefing` 동작

### RSS 폴백 회귀 테스트

RSS provider 실패 시 자동 폴백(`provider=json_file`, `provider_detail` fallback marker)을 점검합니다.

```bash
cd /home/node/.openclaw/workspace/portpoilot-ai
bash scripts/self-test-rss-fallback.sh
```
