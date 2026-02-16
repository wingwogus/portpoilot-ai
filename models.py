from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

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
    ticker: str = Field(..., description="티커")
    summary: str = Field(..., description="설명")
    ratio: int = Field(..., description="비중")
    reason: str = Field(..., description="이유")


class PortfolioResponse(BaseModel):
    market_analysis: str = Field(..., description="시장 분석")
    summary_comment: str = Field(..., description="한줄평")
    items: List[PortfolioItem] = Field(..., description="종목 리스트")


class SurveyRequest(BaseModel):
    age: int
    seed_money: int
    risk_tolerance: str
    goal: str


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
    status: str
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
    audience: str
    tone: str
    headline: str
    summary: str
    bullets: List[str]
