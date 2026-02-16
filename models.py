from pydantic import BaseModel, Field
from typing import List

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