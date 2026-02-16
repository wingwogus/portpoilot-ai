from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from models import (
    MarketBriefingResponse,
    PortfolioResponse,
    SurveyRequest,
    CheckupCreateRequest,
    CheckupCreateResponse,
    JobResponse,
    CheckupResponse,
    RecomposeRequest,
    BriefingRequest,
    BriefingResponse,
)
from services import (
    publish_daily_report,
    get_briefing_data,
    generate_portfolio_logic,
    create_checkup,
    get_job,
    get_checkup,
    recompose_checkup,
    create_briefing,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await publish_daily_report()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="PortPilot AI",
    description="Lightweight FastAPI prototype for portfolio + Reason MVP checkup APIs",
    version="0.2.0",
)


# --- Existing endpoints (kept for compatibility) ---
@app.get("/market-briefing", response_model=MarketBriefingResponse, tags=["legacy"])
async def get_market_briefing():
    data = get_briefing_data()
    if not data:
        raise HTTPException(status_code=503, detail="분석 데이터가 없습니다.")
    return data


@app.post("/generate-portfolio", response_model=PortfolioResponse, tags=["legacy"])
async def generate_portfolio(request: SurveyRequest):
    try:
        return generate_portfolio_logic(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Reason MVP checkup endpoints ---
@app.post("/api/v1/checkups", response_model=CheckupCreateResponse, tags=["checkups"])
async def post_checkups(request: CheckupCreateRequest):
    return await create_checkup(request)


@app.get("/api/v1/jobs/{job_id}", response_model=JobResponse, tags=["checkups"])
async def get_job_status(job_id: str):
    job = await get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    return job


@app.get("/api/v1/checkups/{checkup_id}", response_model=CheckupResponse, tags=["checkups"])
async def get_checkup_detail(checkup_id: str):
    checkup = await get_checkup(checkup_id)
    if not checkup:
        raise HTTPException(status_code=404, detail="checkup not found")
    return checkup


@app.post("/api/v1/checkups/{checkup_id}/recompose", response_model=CheckupResponse, tags=["checkups"])
async def post_checkup_recompose(checkup_id: str, request: RecomposeRequest):
    checkup = await recompose_checkup(checkup_id, request.focus)
    if not checkup:
        raise HTTPException(status_code=404, detail="checkup not found")
    return checkup


@app.post("/api/v1/checkups/{checkup_id}/briefings", response_model=BriefingResponse, tags=["checkups"])
async def post_checkup_briefings(checkup_id: str, request: BriefingRequest):
    briefing = await create_briefing(checkup_id, request.audience, request.tone)
    if not briefing:
        raise HTTPException(status_code=404, detail="completed checkup not found")
    return briefing
