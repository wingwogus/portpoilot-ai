# Reason MVP Frontend Prototype (Next.js 16 + Tailwind)

Fast mobile-first prototype for the Reason flow.

## Stack
- Next.js 16 (App Router, TypeScript)
- Tailwind CSS 4
- Mocked API client contracts (no backend dependency)

## Routes
- `/checkup` — capture objective + concern input
- `/processing` — transient loading state
- `/result` — score, strengths, blind spots, recommendation
- `/recompose` — reframe output with tone/focus
- `/briefing` — stakeholder-ready talking points

## Project Structure
- `src/app/*` route pages
- `src/components/*` reusable mobile shell + UI primitives
- `src/lib/api/contracts.ts` API contract interfaces
- `src/lib/api/mock-client.ts` mocked API implementation
- `src/lib/types.ts` shared domain types

## Run Locally
```bash
cd web
npm install
npm run dev
```

Open: <http://localhost:3000>

## Notes
- Checkup data is stored in `localStorage` keyed by mock `jobId`.
- `mockReasonApi` simulates async latency and deterministic mock outputs.
- Ready to swap with a real API by implementing `ReasonApi` contract.

---

## 디자인 가이드 v1 (Notion 기획 의도 정렬안)

> 목적: 현재 프로토타입의 **모바일 중심/결과 중심 UI**를, 기획 의도인 **의사결정 보조형 데스크톱 경험**으로 교정한다.  
> 핵심 원칙: `체크업 → 진단 → 재구성 → 브리핑`이 각각 독립 가치와 명확한 산출물을 갖도록 구성.

### 1) 화면별 IA / 유저플로우

#### A. 체크업 (입력 수집)
- **목표:** 사용자의 의사결정 맥락을 구조화해 진단 가능한 입력으로 변환
- **입력 IA:**
  - 목표(Goal)
  - 우려/리스크(Concern)
  - 기간(Horizon)
  - (권장 추가) 의사결정 대상/청중, 성공 기준(KPI), 제약조건
- **출력:** `checkupId`, 입력 요약 카드
- **완료 조건:** 필수 입력 + 최소 글자수 + 금지/모호 표현 경고 확인
- **다음 단계 CTA:** “진단 시작” (주요), “입력 저장 후 나중에” (보조)

#### B. 진단 (해석/근거 제시)
- **목표:** 점수 표시가 아니라, “왜 이 결론인지”를 설명
- **결과 IA:**
  - 신뢰 점수 + 리스크 레벨
  - 강점 / 블라인드 스팟
  - 핵심 요약
  - 권장 액션(우선순위)
  - **근거 표시(Evidence):** 입력 문장과 결과 문장 매핑
- **출력:** `resultId`, 핵심 진단 스냅샷
- **완료 조건:** 최소 1개 이상 근거 표시 + 실행 가능한 제안
- **다음 단계 CTA:** “재구성하기”

#### C. 재구성 (전략 관점 변경)
- **목표:** 동일 데이터 기반으로 톤/포커스/청중에 맞춘 재작성
- **입력 IA:**
  - 톤(균형/공격/보수)
  - 포커스(예: 전환율/리스크 방어/실행속도)
  - 청중(내부팀/리더십/외부고객)
- **출력 IA:**
  - 재구성 요약
  - 다음 액션 3~5개
  - 원문 대비 변경점(diff)
- **완료 조건:** 변경 이유(왜 이렇게 바뀌었는지) 설명
- **다음 단계 CTA:** “브리핑 생성”

#### D. 브리핑 (공유/의사결정 실행)
- **목표:** 회의/보고에 즉시 사용 가능한 전달물 생성
- **출력 IA:**
  - 헤드라인 1줄
  - Talking Points 3~5개
  - Caveat(주의사항)
  - 권장 의사결정 1줄
- **완료 조건:** 복붙 가능한 구조 + 출처/근거 링크 확인
- **행동 CTA:** “복사”, “다운로드”, “다시 체크업 시작”

---

### 2) 데스크톱 우선 와이어프레임(텍스트)

#### 공통 레이아웃 (1440px 기준)
- 상단: 제품명/현재 단계/세션 상태
- 본문: `좌측 작업영역(8)` + `우측 컨텍스트 패널(4)` 12컬럼
- 하단 고정: 주요 CTA 바(이전/다음/저장)

#### 체크업
- **좌측:** 대형 입력 폼(목표, 리스크, 기간, 성공기준)
- **우측:** “입력 품질” 패널(충분성/모호성/누락 경고)
- **하단 CTA:** [임시저장] [진단 시작]

#### 진단
- **좌측:** 점수 카드(상단), 강점/블라인드스팟 2열, 요약/권장 액션
- **우측:** 근거 패널(입력 문장 ↔ 진단 문장 하이라이트)
- **하단 CTA:** [재구성하기] [브리핑으로]

#### 재구성
- **좌측:** 톤/포커스/청중 설정 + 재구성 결과
- **우측:** 원문 대비 diff(추가/삭제/강조)
- **하단 CTA:** [다시 생성] [브리핑 생성]

#### 브리핑
- **좌측:** 발표용 브리핑 문안(헤드라인/포인트/주의사항)
- **우측:** 근거 출처 요약 + 공유 옵션
- **하단 CTA:** [복사] [내보내기] [새 체크업]

---

### 3) 톤앤매너 / 카피 가이드 (Reason 스타일)

- **성격:** 차분함, 근거 중심, 판단 보조
- **문장 원칙:**
  - 과장 금지 (“확실히”, “무조건” 지양)
  - 설명형 문장 + 실행형 결론
  - 불확실성은 범위로 명시
- **카피 구조:**
  - 제목: “무엇을 판단하는가”
  - 본문: “왜 그렇게 보는가(근거)”
  - 행동: “그래서 지금 무엇을 할 것인가”
- **마이크로카피 예시:**
  - 로딩: “입력 내용을 근거 단위로 정리하고 있어요.”
  - 경고: “목표 기간이 모호해 진단 정확도가 낮아질 수 있어요.”
  - CTA: “진단 시작”, “재구성 적용”, “브리핑 복사”

---

### 4) 컴포넌트 규격

#### Card
- 형태: radius 16, padding 20, border 1
- 계층: Default / Emphasis / Critical
- 내부: 제목, 본문, 메타(업데이트 시간/신뢰도)

#### Warning (경고)
- 타입: info / caution / danger
- 구성: 아이콘 + 1줄 핵심 + 1줄 해결 가이드
- 규칙: danger는 CTA 옆 배치 금지(독립 블록 처리)

#### Evidence (근거 표시)
- 목적: 진단 문장과 입력 출처 연결
- 구성: `결론 문장` + `근거 배지(입력 #n)` + hover시 원문 노출
- 상태: 부족/충분 배지 제공

#### CTA
- 우선순위: Primary 1개, Secondary 최대 2개
- 규칙: 한 화면에 강한 CTA 1개만
- 카피: 동사 시작(예: “진단 시작”, “브리핑 내보내기”)

---

### 5) FE Handoff 체크리스트

- [ ] 단계 정의 일치: checkup / diagnosis / recompose / briefing
- [ ] URL 상태 보장: `jobId`, `resultId`, `mode`, `audience`
- [ ] 공통 레이아웃: 데스크톱 12컬럼 + 우측 컨텍스트 패널
- [ ] 로딩/에러/빈상태 카피가 Reason 톤을 따르는지 확인
- [ ] Warning/Evidence/CTA 컴포넌트 디자인 토큰 분리
- [ ] 접근성: 포커스 링, 키보드 이동, aria-label, 색 대비
- [ ] 분석 이벤트: `checkup_submit`, `diagnosis_view`, `recompose_run`, `briefing_copy`
- [ ] 브리핑 복사/내보내기 후 피드백 토스트 제공
- [ ] Mock API → 실제 API 교체 시 타입 계약 유지

---

### 현재 프로토타입 대비 교정 포인트(요약)
- 모바일 중심 설명을 **데스크톱 의사결정 UI**로 전환
- `/processing`의 단순 대기 화면을 **진단 단계의 일부(근거 수집 상태)**로 승격
- `/result`의 점수 중심 구성을 **근거 중심 구조**로 재정렬
- `/recompose`에 **청중(audience)**와 변경점(diff) 추가
- `/briefing`에 복사/내보내기 액션과 근거 출처 묶음 추가
