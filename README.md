# PortPilot AI - FastAPI (ETF Recommendation Core)

사용자 성향 기반 ETF 추천 API(`/generate-portfolio`)를 핵심으로 정비한 백엔드입니다.
기존 `/market-briefing`는 유지되며 부가 기능으로 동작합니다.

---

## 핵심 변경사항

1. `/generate-portfolio` 입력 검증 강화
   - `age`: 19~100
   - `seed_money`: 100,000 ~ 10,000,000,000
   - `risk_tolerance`: `보수적 | 중립 | 공격적` (별칭 `보수/중립형/공격` 허용)
   - `goal`: 2~200자
2. 에러 메시지 개선
   - FastAPI validation 에러를 `field/message` 구조로 반환
3. `USE_MOCK_OLLAMA` 분기 명확화
   - `true`: 명시적 Mock 추천 경로 사용
   - `false`: Ollama 추론 경로 사용
4. 응답에 `source` 필드 추가
   - `mock | ollama`
5. CORS 유지
   - `http://localhost:3000`, `http://127.0.0.1:3000`

---

## 실행

```bash
cd /home/node/.openclaw/workspace/portpoilot-ai
python3 -m uvicorn main:app --reload --port 8000
```

### 환경변수

```bash
# Mock 경로(기본값)
export USE_MOCK_OLLAMA=true

# 실제 Ollama 경로
export USE_MOCK_OLLAMA=false
```

> `USE_MOCK_OLLAMA=false`일 때는 Ollama/LangChain 관련 의존성과 모델 준비가 필요합니다.

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

## 2) 부가 기능: `GET /market-briefing`
- 기존 endpoint 유지

## 3) Reason MVP: `/api/v1/*`
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

# 3) 레거시/부가 기능 유지 확인
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
2. `/generate-portfolio` 기본 요청 성공
3. 응답 `source` 필드(`mock|ollama`) 존재
4. `/market-briefing` 동작
5. `/api/v1` 기존 checkup 흐름 호환
