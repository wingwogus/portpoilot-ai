from typing import List, Optional, Dict, Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

# --- 섹터 및 브리핑 관련 ---
class SectorInfo(BaseModel):
    name: str = Field(..., description="섹터명")
    status: str = Field(..., description="시장 관점 (Bullish/Bearish/Neutral)")
    summary: str = Field(..., description="동향 요약")


class MarketBriefingResponse(BaseModel):
    date: str = Field(..., description="발행 날짜")
    macro_summary: str = Field(..., description="거시 경제 3줄 요약")
    sectors: List[SectorInfo] = Field(..., description="섹터별 분석")


# --- 포트폴리오 관련 ---
class PortfolioItem(BaseModel):
    ticker: str = Field(..., min_length=1, description="티커")
    summary: str = Field(..., min_length=2, description="설명")
    ratio: int = Field(..., ge=5, le=100, description="비중")
    reason: str = Field(..., min_length=2, description="이유")

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("ratio")
    @classmethod
    def ratio_step_check(cls, value: int) -> int:
        if value % 5 != 0:
            raise ValueError("ratio는 5 단위 정수여야 합니다.")
        return value


class PortfolioResponse(BaseModel):
    market_analysis: str = Field(..., min_length=10, description="시장 분석")
    summary_comment: str = Field(..., min_length=5, description="한줄평")
    items: List[PortfolioItem] = Field(..., min_length=1, description="종목 리스트")
    source: Literal["ollama"] = Field(..., description="추천 생성 소스")

    @model_validator(mode="after")
    def validate_allocations(self):
        total = sum(item.ratio for item in self.items)
        if total != 100:
            raise ValueError(f"포트폴리오 비중 합은 100이어야 합니다. 현재 {total}")
        return self


class SurveyRequest(BaseModel):
    age: int = Field(..., ge=19, le=100, description="만 19~100세")
    seed_money: int = Field(..., ge=100000, le=10_000_000_000, description="투자 가능 금액(원)")
    risk_tolerance: str = Field(..., min_length=1, description="투자 성향")
    goal: str = Field(..., min_length=2, max_length=200, description="투자 목표")

    @field_validator("risk_tolerance")
    @classmethod
    def normalize_risk_tolerance(cls, value: str) -> str:
        normalized = value.strip().lower()
        aliases = {
            "보수": "보수적",
            "보수적": "보수적",
            "안정형": "보수적",
            "중립": "중립",
            "중립형": "중립",
            "공격": "공격적",
            "공격적": "공격적",
            "공격형": "공격적",
        }
        if normalized not in aliases:
            raise ValueError("risk_tolerance는 보수적/중립/공격적 중 하나여야 합니다.")
        return aliases[normalized]

    @field_validator("goal")
    @classmethod
    def normalize_goal(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("goal은 최소 2자 이상 입력해 주세요.")
        return value

    @model_validator(mode="after")
    def age_seed_sanity_check(self):
        if self.age <= 25 and self.seed_money > 2_000_000_000:
            raise ValueError("입력값을 다시 확인해 주세요: age 대비 seed_money가 비정상적으로 큽니다.")
        return self


# --- Reason MVP Checkup API 관련 ---
class CheckupCreateRequest(BaseModel):
    product_name: str = Field(..., description="서비스/제품 이름")
    service_url: Optional[str] = Field(None, description="서비스 URL")
    target_user: str = Field(..., description="핵심 타겟 유저")
    goal: str = Field(..., description="이번 점검 목표")
    notes: Optional[str] = Field(None, description="추가 메모")


class CheckupCreateResponse(BaseModel):
    checkup_id: str = Field(..., description="생성된 체크업 ID")
    job_id: str = Field(..., description="비동기 작업 ID")
    status: str = Field(..., description="작업 상태")
    result: Optional[Dict[str, Any]] = Field(
        None,
        description="/api/v1 공통 필드. 생성 직후에는 null",
    )


class JobResponse(BaseModel):
    job_id: str
    status: str = Field(..., description="PENDING | RUNNING | COMPLETED | FAILED")
    checkup_id: str
    created_at: str
    updated_at: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class CheckupFinding(BaseModel):
    area: str
    score: int = Field(..., ge=0, le=100)
    summary: str
    evidence: List[str]
    recommendation: str


class CheckupResponse(BaseModel):
    checkup_id: str
    job_id: Optional[str] = Field(None, description="마지막으로 연관된 작업 ID")
    status: str
    result: Optional[Dict[str, Any]] = Field(
        None,
        description="/api/v1 공통 필드. 상세 체크업 요약 페이로드",
    )
    created_at: str
    updated_at: str
    request: CheckupCreateRequest
    overall_score: int = Field(..., ge=0, le=100)
    verdict: str
    findings: List[CheckupFinding]
    next_actions: List[str]
    recomposed_version: int = 1


class RecomposeRequest(BaseModel):
    focus: Optional[str] = Field(None, description="재작성 초점 (예: onboarding, copy, conversion)")


class BriefingRequest(BaseModel):
    audience: str = Field("team", description="요약 대상 (team/executive/client)")
    tone: str = Field("neutral", description="요약 톤 (neutral/actionable/concise)")


class BriefingResponse(BaseModel):
    checkup_id: str
    job_id: Optional[str] = Field(None, description="briefing 생성 요청과 연관된 checkup의 job ID")
    status: str = Field(..., description="checkup의 현재 상태")
    result: Dict[str, Any] = Field(..., description="/api/v1 공통 필드. FE 렌더링용 briefing payload")
    audience: str
    tone: str
    headline: str
    summary: str
    bullets: List[str]


# --- ETF 뉴스 RAG API 관련 ---
class ETFNewsItem(BaseModel):
    doc_id: str
    title: str
    source_link: str
    published_at: str
    summary: str
    signal: Literal["bullish", "bearish", "neutral"]
    evidence: List[str]
    ticker_hits: List[str]
    sector_tags: List[str]
    score: float = Field(..., ge=0.0, le=1.0)
    score_explain: str = Field(..., description="가중치 기반 점수 설명")


class ETFNewsResponse(BaseModel):
    query_tickers: List[str]
    query_expansion_terms: List[str] = Field(default_factory=list)
    count: int = Field(..., ge=0)
    cached: bool
    items: List[ETFNewsItem]


class ETFNewsIndexStatusResponse(BaseModel):
    indexed_docs: int = Field(..., ge=0)
    cache_ttl_seconds: int = Field(..., ge=0)
    embed_dim: int = Field(..., ge=1)
    cached_queries: int = Field(..., ge=0)
    provider: Optional[str] = None
    provider_detail: Optional[str] = None
    built_at: Optional[str] = None
    data_path: Optional[str] = None
    error: Optional[str] = None


# --- ETF 투자 의사결정 RAG API ---
class ETFDecisionEvent(BaseModel):
    doc_id: str
    event: str
    market_reaction: str
    published_at: str
    source: str
    source_link: str
    relevance_score: float = Field(..., ge=0.0, le=1.0)


class ETFDecisionEvidence(BaseModel):
    doc_id: str
    event: str
    cause: str
    development: str
    market_reaction: str
    factor_scores: Dict[str, float]
    source: str
    source_link: str


class ETFDecisionItem(BaseModel):
    ticker: str
    signal: Literal["bullish", "neutral", "bearish"]
    confidence: float = Field(..., ge=0.0, le=1.0)
    conclusion: str
    causal_summary: str
    key_events: List[ETFDecisionEvent]
    evidence: List[ETFDecisionEvidence]
    risk_invalidation_conditions: List[str]
    factor_exposure_used: Dict[str, float]


class ETFDecisionBriefResponse(BaseModel):
    query_tickers: List[str]
    generated_at: str
    index_built_at: Optional[str] = None
    results: List[ETFDecisionItem]


class ETFDecisionIndexStatusResponse(BaseModel):
    indexed_docs: int = Field(..., ge=0)
    embed_dim: int = Field(..., ge=1)
    raw_dir: str
    brief_dir: str
    archives_by_date: Dict[str, int]
    latest_loaded: Dict[str, bool]
    built_at: Optional[str] = None
    error: Optional[str] = None
