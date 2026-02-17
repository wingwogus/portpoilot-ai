# PortPilot AI Web (Next.js 16)

성향 설문 + ETF 뉴스 대시보드 + ETF 의사결정 브리프를 제공하는 프론트엔드입니다.

## 핵심 화면
- `/` : ETF 뉴스 카드 + 요약 시그널 + 홈 브리프 미리보기
- `/decision-brief` : 티커 직접 입력형 ETF 의사결정 브리프 조회
- `/survey` : 5문항 내외 투자 성향 설문
- `/portfolio-result` : FastAPI `POST /generate-portfolio` 실연동 결과 화면

기존 `/checkup`, `/processing`, `/result`, `/recompose`, `/briefing`는 보조 라우트로 축소되어 핵심 플로우로 리다이렉트됩니다.

## 스택
- Next.js 16 (App Router, TypeScript)
- Tailwind CSS 4

## 로컬 실행
```bash
# terminal 1: backend
cd /home/node/.openclaw/workspace/portpoilot-ai
python3 -m uvicorn main:app --reload --port 8000

# terminal 2: frontend
cd /home/node/.openclaw/workspace/portpoilot-ai/web
npm install
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev
```

- Frontend: <http://localhost:3000>
- 홈 대시보드: <http://localhost:3000/>
- 의사결정 브리프: <http://localhost:3000/decision-brief>
- 설문 페이지: <http://localhost:3000/survey>

## API 연동
- `GET /etf-news`
  - 홈 대시보드 ETF 카드 데이터 소스
- `GET /etf-decision-brief`
  - 홈 브리프 미리보기 + 전용 브리프 화면 데이터 소스
- `POST /generate-portfolio`
  - 설문 결과 기반 ETF 포트폴리오 생성

## UX 개선 포인트 (MVP)
- 홈 대시보드에서 뉴스/브리프 로딩 상태 분리 처리
- 오류 시 API 메시지 최대한 노출 (`error | message | detail` 파싱)
- 브리프 전용 페이지에서 티커 입력 검증/에러/빈결과/로딩 상태 제공

## 간단 연동 점검
백엔드가 실행 중일 때 아래 스크립트로 핵심 endpoint 계약을 빠르게 확인할 수 있습니다.

```bash
cd /home/node/.openclaw/workspace/portpoilot-ai/web
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run check:integration
```

검증 항목:
- `/etf-news?tickers=QQQ,SPY`
- `/etf-decision-brief?tickers=QQQ,SPY`

## SEO 반영 사항
- semantic 구조(`header`, `main`, `section`, `article`, `aside`)
- 페이지별 metadata `title`/`description`
- 페이지별 단일 `h1` + `h2/h3` 계층 구조
- `metadataBase`/canonical 설정
- `sitemap.ts`, `robots.ts` 반영 (`/`, `/decision-brief`, `/survey`, `/portfolio-result`)

## 빌드
```bash
cd /home/node/.openclaw/workspace/portpoilot-ai/web
npm run build
```
