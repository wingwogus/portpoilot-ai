# PortPilot AI Web (Next.js 16)

성향 설문 → 포트폴리오 결과를 메인 플로우로 재구성한 프론트엔드입니다.

## 핵심 플로우
- `/survey`: 5문항 내외 투자 성향 설문
- `/portfolio-result`: FastAPI `POST /generate-portfolio` 실연동 결과 화면

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
- 설문 페이지: <http://localhost:3000/survey>

## API 연동
`src/lib/api/portfolio-client.ts`에서 아래 엔드포인트를 호출합니다.

- `POST /generate-portfolio`
  - request: `age`, `seed_money`, `risk_tolerance`, `goal`
  - response: `market_analysis`, `summary_comment`, `items[]`

응답은 camelCase로 정규화하여 렌더링합니다.

## 결과 화면 표시 항목
- ETF 비중(합계 100% 보정)
- 종목별 추천 이유
- 위험 성향 기반 리스크 경고
- 한줄 요약
- 시장 해석 코멘트

## SEO 반영 사항
- semantic 구조(`header`, `main`, `section`, `article`, `aside`)
- 페이지별 metadata `title`/`description`
- 페이지별 단일 `h1` + `h2/h3` 계층 구조
- `metadataBase`/canonical 설정
- `sitemap.ts`, `robots.ts` 추가

## 빌드
```bash
cd /home/node/.openclaw/workspace/portpoilot-ai/web
npm run build
```
