# main.py
from fastapi import FastAPI, HTTPException
from contextlib import asynccontextmanager
from models import MarketBriefingResponse, PortfolioResponse, SurveyRequest # 모델 임포트
from services import publish_daily_report, get_briefing_data, generate_portfolio_logic # 로직 임포트

@asynccontextmanager
async def lifespan(app: FastAPI):
    await publish_daily_report()
    yield

app = FastAPI(lifespan=lifespan, title="PortPilot AI")

@app.get("/market-briefing", response_model=MarketBriefingResponse)
async def get_market_briefing():
    data = get_briefing_data()
    if not data:
        raise HTTPException(status_code=503, detail="분석 데이터가 없습니다.")
    return data

@app.post("/generate-portfolio", response_model=PortfolioResponse)
async def generate_portfolio(request: SurveyRequest):
    try:
        return generate_portfolio_logic(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))