# PortPilot AI - FastAPI (ETF Recommendation + ETF 뉴스 RAG)

사용자 성향 기반 ETF 추천 API(`/generate-portfolio`)와
내장 VectorDB 기반 ETF 뉴스 RAG API(`/etf-news`)를 제공하는 백엔드입니다.
기존 `/market-briefing`, `/api/v1/checkups`는 유지됩니다.

---

## 핵심 변경사항

1. `/generate-portfolio` 입력 검증 강화
   - `age`: 19~100
   - `seed_money`: 100,000 ~ 10,000,000,000
   - `risk_tolerance`: `보수적 | 중립 | 공격적` (별칭 `보수/중립형/공격` 허용)
   - `goal`: 2~200자
2. 내장 VectorDB 기반 ETF 뉴스 RAG 1차 구현
   - 뉴스 수집/정규화 파이프라인: `data/sample_etf_news.json` 로드 후 정규화
   - 임베딩 저장: 해시 기반 임베딩(192-dim) 생성 후 메모리 VectorDB 인덱싱
   - 메타태그 저장: `tickers`, `sectors` 태그와 함께 검색
   - ETF별 검색 API 추가: `GET /etf-news?tickers=QQQ,SCHD`
   - 응답 필드: `source_link`, `summary`, `signal`, `evidence`, `sector_tags`, `ticker_hits`
   - 최근 뉴스 우선 로직: 시간 기반 recency boost + TTL 캐시(기본 5분)
3. 에러 메시지 개선
   - FastAPI validation 에러를 `field/message` 구조로 반환
4. CORS 유지
   - `http://localhost:3000`, `http://127.0.0.1:3000`

---

## 실행

```bash
cd /home/node/.openclaw/workspace/portpoilot-ai
python3 -m uvicorn main:app --reload --port 8000
```

### 환경변수

```bash
# 기본값: false (실 Ollama 경로)
export USE_MOCK_OLLAMA=false
```

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
  "source": "mock"
}
```

### 검증 에러 예시(422)

```json
{
  "error": "입력값 검증에 실패했습니다.",
  "details": [
    {"field":"age","message":"Input should be greater than or equal to 19"}
  ]
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
      "score": 0.7421
    }
  ]
}
```

## 3) 부가 기능: `GET /market-briefing`
- 기존 endpoint 유지

## 4) Reason MVP: `/api/v1/*`
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

# 4) 레거시/부가 기능 유지 확인
curl -s 'http://localhost:8000/market-briefing'
```

---

## Self-test

서버 실행 후:

```bash
cd /home/node/.openclaw/workspace/portpoilot-ai
bash scripts/self-test.sh
```

검증 항목:
1. CORS preflight
2. `/api/v1` checkup 생성/완료/조회/recompose/briefing
3. `/etf-news?tickers=QQQ,SCHD` 실제 검색 흐름 동작
4. ETF 뉴스 응답에 `source_link/summary/signal/evidence` 포함
5. `/generate-portfolio` 기본 요청 검증 (`source` 확인 또는 Ollama 미연결 503 확인)
6. `/market-briefing` 동작
