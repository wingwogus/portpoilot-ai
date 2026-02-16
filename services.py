import os
import json
import datetime
import asyncio
import hashlib
from copy import deepcopy
from typing import Dict, Any, Optional

from models import (
    MarketBriefingResponse,
    PortfolioResponse,
    CheckupCreateRequest,
    CheckupFinding,
)

# Ollama는 현재 더미 모드로 운용
USE_MOCK_OLLAMA = os.getenv("USE_MOCK_OLLAMA", "true").lower() in ("1", "true", "yes", "on")

if not USE_MOCK_OLLAMA:
    from langchain_ollama import ChatOllama
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.output_parsers import JsonOutputParser
    from langchain_community.tools import DuckDuckGoSearchRun


REPORT_DIR = "reports"
os.makedirs(REPORT_DIR, exist_ok=True)

DAILY_BRIEFING_DATA: Dict[str, Any] = {}
WEEKLY_CONTEXT_SUMMARY: str = ""

# --- In-memory stores for Reason MVP prototype ---
CHECKUPS: Dict[str, Dict[str, Any]] = {}
JOBS: Dict[str, Dict[str, Any]] = {}
_CHECKUP_SEQ = 0
_JOB_SEQ = 0
_STORE_LOCK = asyncio.Lock()

if not USE_MOCK_OLLAMA:
    llm = ChatOllama(model="gemma2:9b", temperature=0.0, format="json", seed=42)
    search = DuckDuckGoSearchRun()

    briefing_parser = JsonOutputParser(pydantic_object=MarketBriefingResponse)
    briefing_prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            """
        당신은 수석 금융 시장 분석가입니다.
        제공된 뉴스 데이터를 분석하여 메인 대시보드용 일일 시장 리포트를 작성하세요.
        {format_instructions}
        """,
        ),
        ("human", "{raw_news}"),
    ])
    briefing_chain = briefing_prompt | llm | briefing_parser

    portfolio_parser = JsonOutputParser(pydantic_object=PortfolioResponse)
    portfolio_prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            """
        당신은 ETF 전문 펀드매니저입니다.
        최근 시장 흐름과 사용자 프로필을 반영해 미국 ETF 포트폴리오를 제안하세요.
        - ONLY ETF
        - ratio는 5% 또는 10% 단위
        - 지정 JSON 형식만 출력
        {format_instructions}
        """,
        ),
        (
            "human",
            """
        [최근 1주일 시장 요약]
        {weekly_context}

        [사용자 프로필]
        나이:{age}, 자산:{seed_money}, 성향:{risk_tolerance}, 목표:{goal}
        """,
        ),
    ])
    portfolio_chain = portfolio_prompt | llm | portfolio_parser


def _to_dict(model_obj: Any) -> Dict[str, Any]:
    if hasattr(model_obj, "model_dump"):
        return model_obj.model_dump()
    return model_obj.dict()


def _now_iso() -> str:
    return datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def _next_checkup_id() -> str:
    global _CHECKUP_SEQ
    _CHECKUP_SEQ += 1
    return f"chk_{_CHECKUP_SEQ:04d}"


def _next_job_id() -> str:
    global _JOB_SEQ
    _JOB_SEQ += 1
    return f"job_{_JOB_SEQ:04d}"


def _deterministic_score(seed_text: str, offset: int, low: int = 55, high: int = 92) -> int:
    digest = hashlib.sha256((seed_text + f":{offset}").encode("utf-8")).hexdigest()
    number = int(digest[:8], 16)
    return low + (number % (high - low + 1))


def _build_checkup_result(
    checkup_id: str,
    request_data: Dict[str, Any],
    recomposed_version: int = 1,
    job_id: Optional[str] = None,
) -> Dict[str, Any]:
    base_seed = f"{checkup_id}|{request_data.get('product_name')}|{request_data.get('target_user')}|{request_data.get('goal')}|v{recomposed_version}"

    findings = [
        CheckupFinding(
            area="Value Proposition",
            score=_deterministic_score(base_seed, 1),
            summary="핵심 가치 제안은 명확하지만 차별 포인트가 첫 화면에서 약합니다.",
            evidence=[
                "메인 카피에서 기능 설명 비중이 높고 결과 효용 표현이 적음",
                "첫 5초 내 사용자 이득 문구가 1개 이하",
            ],
            recommendation="첫 섹션에 타겟별 성과 문장을 배치하고, 경쟁 대비 장점을 수치로 제시하세요.",
        ),
        CheckupFinding(
            area="Onboarding Flow",
            score=_deterministic_score(base_seed, 2),
            summary="가입 동선은 짧지만 초기 설정 질문의 맥락 안내가 부족합니다.",
            evidence=[
                "1~2단계에서 왜 이 정보가 필요한지 설명 부재",
                "중도 이탈 가능 구간에 진행 이점 안내 없음",
            ],
            recommendation="각 질문에 '왜 필요한지' 툴팁을 추가하고, 완료 시 즉시 얻는 결과를 강조하세요.",
        ),
        CheckupFinding(
            area="Trust & Credibility",
            score=_deterministic_score(base_seed, 3),
            summary="신뢰 요소가 일부 있으나 사회적 증거의 최신성이 낮습니다.",
            evidence=[
                "고객 사례 업데이트 주기가 길어 보임",
                "보안/개인정보 처리 고지 링크 가시성이 낮음",
            ],
            recommendation="최근 3개월 내 성과 사례를 상단에 배치하고 보안 배지를 CTA 근처에 노출하세요.",
        ),
        CheckupFinding(
            area="Conversion Clarity",
            score=_deterministic_score(base_seed, 4),
            summary="주 CTA 문구가 일반적이며 사용자의 다음 행동을 구체적으로 유도하지 못합니다.",
            evidence=[
                "CTA가 '시작하기'로만 표기되어 기대 결과 불명확",
                "대안 CTA와의 역할 구분 부족",
            ],
            recommendation="'3분 안에 맞춤 진단 받기'처럼 시간+결과형 CTA로 바꾸고, 보조 CTA를 명확히 분리하세요.",
        ),
    ]

    overall = sum(item.score for item in findings) // len(findings)
    if overall >= 80:
        verdict = "Strong"
    elif overall >= 65:
        verdict = "Promising"
    else:
        verdict = "Needs Work"

    next_actions = [
        "Top 1 이탈 구간(온보딩 2단계) 카피 A/B 테스트",
        "메인 CTA 문구를 결과형 문장으로 교체 후 전환율 비교",
        "최근 고객 성과 사례 2건을 상단 섹션에 추가",
    ]

    summary_result = {
        "overall_score": overall,
        "verdict": verdict,
        "top_areas": [item.area for item in findings[:3]],
        "next_actions": next_actions,
    }

    return {
        "checkup_id": checkup_id,
        "job_id": job_id,
        "status": "COMPLETED",
        "result": summary_result,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "request": request_data,
        "overall_score": overall,
        "verdict": verdict,
        "findings": [_to_dict(f) for f in findings],
        "next_actions": next_actions,
        "recomposed_version": recomposed_version,
    }


def _mock_briefing(today: str) -> Dict[str, Any]:
    return {
        "date": today,
        "macro_summary": "연준의 금리 동결 기대가 유지되며 시장 변동성은 완만한 수준입니다. 물가 둔화 신호가 이어지지만 고용은 견조해 혼조 흐름입니다. 단기적으로는 실적 시즌과 장기금리 변화가 방향성을 좌우할 전망입니다.",
        "sectors": [
            {"name": "Information Technology", "status": "상승세 (좋음)", "summary": "AI/반도체 수요 기대 반영"},
            {"name": "Communication Services", "status": "보합세 (지켜보는 중)", "summary": "대형 플랫폼 광고 회복 기대"},
            {"name": "Consumer Discretionary", "status": "보합세 (지켜보는 중)", "summary": "소비 둔화 우려와 실적 기대가 혼재"},
            {"name": "Consumer Staples", "status": "보합세 (지켜보는 중)", "summary": "방어적 수요 유입"},
            {"name": "Energy", "status": "하락세 (주의)", "summary": "유가 조정 영향"},
            {"name": "Financials", "status": "보합세 (지켜보는 중)", "summary": "금리 레벨 영향 지속"},
            {"name": "Health Care", "status": "상승세 (좋음)", "summary": "방어+성장 균형 매력"},
            {"name": "Industrials", "status": "보합세 (지켜보는 중)", "summary": "인프라 투자 기대"},
            {"name": "Materials", "status": "보합세 (지켜보는 중)", "summary": "원자재 가격 안정"},
            {"name": "Real Estate", "status": "하락세 (주의)", "summary": "금리 민감도 부담"},
            {"name": "Utilities", "status": "보합세 (지켜보는 중)", "summary": "배당 매력은 유효"},
        ],
    }


def _mock_portfolio(request) -> Dict[str, Any]:
    if "공격" in request.risk_tolerance:
        items = [
            {"ticker": "TQQQ", "summary": "나스닥 3배 레버리지", "ratio": 30, "reason": "성장 모멘텀 극대화"},
            {"ticker": "SOXL", "summary": "반도체 3배 레버리지", "ratio": 20, "reason": "AI 사이클 수혜"},
            {"ticker": "QQQ", "summary": "미국 대형 기술주", "ratio": 20, "reason": "핵심 성장축"},
            {"ticker": "VOO", "summary": "S&P500 추종", "ratio": 20, "reason": "시장 베타 확보"},
            {"ticker": "TLT", "summary": "미 장기채", "ratio": 10, "reason": "변동성 완충"},
        ]
    else:
        items = [
            {"ticker": "VOO", "summary": "S&P500 추종", "ratio": 40, "reason": "기본 시장 노출"},
            {"ticker": "SCHD", "summary": "배당 성장", "ratio": 25, "reason": "현금흐름 안정성"},
            {"ticker": "QQQ", "summary": "기술 성장", "ratio": 15, "reason": "장기 성장성 보완"},
            {"ticker": "TLT", "summary": "미 장기채", "ratio": 20, "reason": "방어력 보강"},
        ]

    return {
        "market_analysis": "현재는 금리/실적 이벤트 중심의 박스권 장세로, 주도 섹터(기술) 중심 전략과 방어 자산의 균형이 중요합니다.",
        "summary_comment": "변동성 구간에서는 핵심지수+주도섹터+완충자산의 3축이 유효합니다.",
        "items": items,
        "source": "mock",
    }


async def fetch_news_sequentially():
    news_data = {}
    try:
        news_data["macro"] = search.invoke("US Fed interest rate inflation CPI PPI economy news today summary")
        await asyncio.sleep(1)
        news_data["sector"] = search.invoke("US stock market S&P 500 11 sectors performance winners and losers today summary")
        await asyncio.sleep(1)
        news_data["risk"] = search.invoke("US stock market geopolitical risk war oil price fear and greed index")
        return f"[거시경제 뉴스]: {news_data['macro']}\n[섹터별 뉴스]: {news_data['sector']}\n[시장 리스크]: {news_data['risk']}"
    except Exception as e:
        print(f"⚠️ 검색 실패: {e}")
        return None


def load_weekly_reports_summary() -> str:
    summary_text = ""
    today = datetime.date.today()
    found_count = 0

    for i in range(7):
        target_date = today - datetime.timedelta(days=i)
        filename = f"{REPORT_DIR}/market_report_{target_date.isoformat()}.json"
        if not os.path.exists(filename):
            continue

        try:
            with open(filename, "r", encoding="utf-8") as f:
                data = json.load(f)
            summary_text += f"\n=== [날짜: {data.get('date', target_date.isoformat())}] ===\n"
            summary_text += f"- 거시경제: {data.get('macro_summary', '내용 없음')}\n"
            for s in data.get("sectors", []):
                short_status = s.get("status", "").split("(")[0].strip()
                summary_text += f"  * {s.get('name', 'Unknown')}: {short_status} ({s.get('summary', '이유 없음')})\n"
            found_count += 1
        except Exception as e:
            print(f"⚠️ 파일 읽기 오류 ({filename}): {e}")

    return summary_text if found_count else "최근 데이터가 없습니다."


async def publish_daily_report():
    global DAILY_BRIEFING_DATA, WEEKLY_CONTEXT_SUMMARY

    today_str = datetime.date.today().isoformat()
    today_filename = f"{REPORT_DIR}/market_report_{today_str}.json"

    if os.path.exists(today_filename):
        try:
            with open(today_filename, "r", encoding="utf-8") as f:
                DAILY_BRIEFING_DATA = json.load(f)
        except Exception:
            DAILY_BRIEFING_DATA = {}

    if not DAILY_BRIEFING_DATA:
        if USE_MOCK_OLLAMA:
            DAILY_BRIEFING_DATA = _mock_briefing(today_str)
            with open(today_filename, "w", encoding="utf-8") as f:
                json.dump(DAILY_BRIEFING_DATA, f, ensure_ascii=False, indent=2)
            print("✅ [Mock] 오늘의 리포트 저장 완료")
        else:
            raw_news = await fetch_news_sequentially()
            if raw_news:
                try:
                    report = briefing_chain.invoke(
                        {
                            "raw_news": raw_news,
                            "format_instructions": briefing_parser.get_format_instructions(),
                        }
                    )
                    report["date"] = today_str
                    with open(today_filename, "w", encoding="utf-8") as f:
                        json.dump(report, f, ensure_ascii=False, indent=2)
                    DAILY_BRIEFING_DATA = report
                except Exception as e:
                    print(f"⚠️ 리포트 생성 실패: {e}")
                    DAILY_BRIEFING_DATA = {}

    WEEKLY_CONTEXT_SUMMARY = load_weekly_reports_summary()


def get_briefing_data():
    return DAILY_BRIEFING_DATA


def generate_portfolio_logic(request):
    context = WEEKLY_CONTEXT_SUMMARY or "데이터 부족"

    if USE_MOCK_OLLAMA:
        payload = _mock_portfolio(request)
        return PortfolioResponse.model_validate(payload).model_dump()

    try:
        llm_result = portfolio_chain.invoke(
            {
                "weekly_context": context,
                "age": request.age,
                "seed_money": request.seed_money,
                "risk_tolerance": request.risk_tolerance,
                "goal": request.goal,
                "format_instructions": portfolio_parser.get_format_instructions(),
            }
        )
    except Exception as e:
        raise RuntimeError(f"Ollama 추론 실패: {e}") from e

    if isinstance(llm_result, dict):
        llm_result["source"] = "ollama"
    else:
        raise RuntimeError("Ollama 응답이 JSON 객체 형태가 아닙니다.")

    try:
        return PortfolioResponse.model_validate(llm_result).model_dump()
    except Exception as e:
        raise RuntimeError(f"Ollama 결과 검증 실패: {e}") from e


# --- Reason MVP prototype service functions ---
async def _run_checkup_job(job_id: str, checkup_id: str):
    async with _STORE_LOCK:
        if job_id not in JOBS:
            return
        JOBS[job_id]["status"] = "RUNNING"
        JOBS[job_id]["updated_at"] = _now_iso()

    await asyncio.sleep(1.2)

    async with _STORE_LOCK:
        checkup_record = CHECKUPS.get(checkup_id)
        job_record = JOBS.get(job_id)
        if not checkup_record or not job_record:
            return

        request_data = checkup_record["request"]
        recomposed_version = checkup_record.get("recomposed_version", 1)
        result = _build_checkup_result(
            checkup_id,
            request_data,
            recomposed_version=recomposed_version,
            job_id=job_id,
        )

        # keep initial created_at for consistency
        result["created_at"] = checkup_record["created_at"]
        result["updated_at"] = _now_iso()

        CHECKUPS[checkup_id] = result
        JOBS[job_id]["status"] = "COMPLETED"
        JOBS[job_id]["updated_at"] = _now_iso()
        JOBS[job_id]["result"] = {
            "checkup_id": checkup_id,
            "overall_score": result["overall_score"],
            "verdict": result["verdict"],
        }


async def create_checkup(request: CheckupCreateRequest) -> Dict[str, Any]:
    async with _STORE_LOCK:
        checkup_id = _next_checkup_id()
        job_id = _next_job_id()
        now = _now_iso()

        CHECKUPS[checkup_id] = {
            "checkup_id": checkup_id,
            "job_id": job_id,
            "status": "PENDING",
            "result": None,
            "created_at": now,
            "updated_at": now,
            "request": _to_dict(request),
            "overall_score": 0,
            "verdict": "PENDING",
            "findings": [],
            "next_actions": [],
            "recomposed_version": 1,
        }
        JOBS[job_id] = {
            "job_id": job_id,
            "status": "PENDING",
            "checkup_id": checkup_id,
            "created_at": now,
            "updated_at": now,
            "result": None,
            "error": None,
        }

    asyncio.create_task(_run_checkup_job(job_id, checkup_id))

    return {"checkup_id": checkup_id, "job_id": job_id, "status": "PENDING", "result": None}


async def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    async with _STORE_LOCK:
        row = JOBS.get(job_id)
        return deepcopy(row) if row else None


async def get_checkup(checkup_id: str) -> Optional[Dict[str, Any]]:
    async with _STORE_LOCK:
        row = CHECKUPS.get(checkup_id)
        return deepcopy(row) if row else None


async def recompose_checkup(checkup_id: str, focus: Optional[str]) -> Optional[Dict[str, Any]]:
    async with _STORE_LOCK:
        row = CHECKUPS.get(checkup_id)
        if not row:
            return None

        base_request = row["request"]
        next_version = int(row.get("recomposed_version", 1)) + 1

        if focus:
            base_request = dict(base_request)
            base_request["goal"] = f"{base_request.get('goal', '')} | focus:{focus}"

        recomposed = _build_checkup_result(
            checkup_id,
            base_request,
            recomposed_version=next_version,
            job_id=row.get("job_id"),
        )
        recomposed["created_at"] = row["created_at"]
        recomposed["updated_at"] = _now_iso()

        CHECKUPS[checkup_id] = recomposed
        return deepcopy(recomposed)


async def create_briefing(checkup_id: str, audience: str, tone: str) -> Optional[Dict[str, Any]]:
    async with _STORE_LOCK:
        row = CHECKUPS.get(checkup_id)
        if not row or row.get("status") != "COMPLETED":
            return None
        score = row.get("overall_score", 0)
        verdict = row.get("verdict", "Unknown")
        top_issues = [f.get("area") for f in row.get("findings", [])][:3]

    headline = f"{row['request']['product_name']} checkup: {verdict} ({score}/100)"
    summary = (
        f"타겟({row['request']['target_user']}) 기준으로 핵심 사용자 여정 점검 결과 {verdict} 단계입니다. "
        f"우선 개선 영역은 {', '.join(top_issues)} 입니다."
    )

    if tone == "concise":
        bullets = [
            f"Overall: {score}/100",
            f"Top issues: {', '.join(top_issues)}",
            "Action: CTA/온보딩 카피 우선 개선",
        ]
    elif tone == "actionable":
        bullets = [
            "온보딩 2단계 이탈 구간에 맥락 안내 문구 추가",
            "메인 CTA를 결과형 문장으로 교체하고 A/B 테스트",
            "최신 고객 성과 사례를 상단에 배치",
        ]
    else:
        bullets = [
            f"현재 점수는 {score}/100, 평가는 {verdict}",
            f"우선순위 영역: {', '.join(top_issues)}",
            "카피/신뢰요소/CTA 개선 시 단기 전환 개선 여지 큼",
        ]

    briefing_payload = {
        "audience": audience,
        "tone": tone,
        "headline": headline,
        "summary": summary,
        "bullets": bullets,
        "score": score,
        "verdict": verdict,
        "top_issues": top_issues,
    }

    return {
        "checkup_id": checkup_id,
        "job_id": row.get("job_id"),
        "status": row.get("status", "UNKNOWN"),
        "result": briefing_payload,
        "audience": audience,
        "tone": tone,
        "headline": headline,
        "summary": summary,
        "bullets": bullets,
    }
