import os
import json
import datetime
import asyncio
from typing import Dict, List
from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_community.tools import DuckDuckGoSearchRun
from models import MarketBriefingResponse, PortfolioResponse

# --- 1. 설정 및 도구 ---
# 분석 일관성을 위해 seed를 고정하고, 창의성(temperature)을 0으로 설정
llm = ChatOllama(model="gemma2:9b", temperature=0.0, format="json", seed=42)
search = DuckDuckGoSearchRun()

# [변경] 리포트를 저장할 폴더 경로 설정
REPORT_DIR = "reports"
if not os.path.exists(REPORT_DIR):
    os.makedirs(REPORT_DIR)

# 전역 저장소 (메모리)
DAILY_BRIEFING_DATA: Dict = {}        # 오늘자 리포트 (메인 화면용)
WEEKLY_CONTEXT_SUMMARY: str = ""      # 최근 1주일 요약본 (포트폴리오 생성용)

# --- 2. 프롬프트 & 체인 정의 ---

# (A) 시장 리포트 발행용 체인 (매일 생성되는 조간 신문)
briefing_parser = JsonOutputParser(pydantic_object=MarketBriefingResponse)
briefing_prompt = ChatPromptTemplate.from_messages([
    ("system", """
    당신은 수석 금융 시장 분석가입니다.
    제공된 뉴스 데이터를 분석하여 메인 대시보드에 띄울 '일일 시장 리포트'를 작성하세요.
    
    [필수 분석 대상 - 11개 GICS 섹터 전체]
    다음 11개 섹터의 동향을 빠짐없이 분석해야 합니다:
    1. Information Technology (정보기술)
    2. Communication Services (커뮤니케이션)
    3. Consumer Discretionary (임의소비재)
    4. Consumer Staples (필수소비재)
    5. Energy (에너지)
    6. Financials (금융)
    7. Health Care (헬스케어)
    8. Industrials (산업재)
    9. Materials (소재)
    10. Real Estate (부동산)
    11. Utilities (유틸리티)
    
    [작성 규칙]
    1. **macro_summary**: 금리, 물가, 연준의 움직임 등 거시 경제 상황을 초보자가 이해하기 쉽게 3문장으로 요약하세요.
    2. **sectors - status**: 'Bullish' 같은 영어 대신, **"상승세 (좋음)", "하락세 (주의)", "보합세 (지켜보는 중)"** 과 같이 직관적인 한국어로 적으세요.
    3. **sectors - summary**: 각 섹터의 이슈를 한국어로 설명하세요.
    
    {format_instructions}
    """),
    ("human", "{raw_news}")
])
briefing_chain = briefing_prompt | llm | briefing_parser

# (B) 포트폴리오 생성용 체인 (★ 1주일 데이터 반영 ★)
portfolio_parser = JsonOutputParser(pydantic_object=PortfolioResponse)
portfolio_prompt = ChatPromptTemplate.from_messages([
    ("system", """
    당신은 월스트리트 20년 경력의 ETF 전문 펀드매니저입니다.
    
    [핵심 목표]
    제공된 [최근 1주일간의 시장 흐름]과 [사용자 프로필]을 종합하여 사용자에게 최적화된 미국 ETF 포트폴리오를 제안하십시오.
    
    [상세 지침]
    1. **시장 흐름 분석**: 
       - 지난 1주일간의 데이터를 바탕으로 현재 시장이 상승 추세인지, 하락 추세인지, 금리 이슈가 어떻게 변하고 있는지 파악하세요.
       - 특히 **현재 금리 수준**과 **주도 섹터의 변화**를 초보자에게 친절하게 설명하세요.
    
    2. **성향별 전략 수립**: 
       - 공격형: TQQQ, SOXL 등 레버리지 및 주도 섹터(AI/반도체 등) 비중 확대.
       - 중립/안정형: VOO, SCHD, TLT 등 시장지수 및 배당/채권 위주 구성.
    
    3. **섹터 로테이션 반영**: 
       - 최근 1주일간 지속적으로 강세를 보이는 섹터를 포트폴리오에 적극 반영하세요.

    4. **ONLY ETF (절대 규칙)**: 
       - 포트폴리오는 **100% 미국 상장 ETF**로만 구성해야 합니다. (개별 주식 절대 금지)

    5. **비중 설정 규칙 (Rounding)**: 
       - 모든 종목의 비중은 **5% 또는 10% 단위**로 설정하세요. (합계 100%)

    6. **출력 형식 (기술적 제약)**: 
       - **반드시 지정된 JSON 형식으로만 응답하세요.**
    
    {format_instructions}
    """),
    
    ("human", """
    [최근 1주일간의 시장 리포트 요약 (Context)]
    {weekly_context}
    
    [사용자 프로필]
    나이: {age}, 자산: {seed_money}, 성향: {risk_tolerance}, 목표: {goal}
    """)
])
portfolio_chain = portfolio_prompt | llm | portfolio_parser

# --- 3. 비즈니스 로직 함수 ---

async def fetch_news_sequentially():
    news_data = {}
    try:
        print("🔍 [Service] 거시경제 뉴스 검색...")
        news_data['macro'] = search.invoke("US Fed interest rate inflation CPI PPI economy news today summary")
        await asyncio.sleep(2) # 밴 방지

        print("🔍 [Service] 11개 섹터 전반 뉴스 검색...")
        news_data['sector'] = search.invoke("US stock market S&P 500 11 sectors performance winners and losers today summary")
        await asyncio.sleep(2) # 밴 방지

        print("🔍 [Service] 리스크 뉴스 검색...")
        news_data['risk'] = search.invoke("US stock market geopolitical risk war oil price fear and greed index")
        
        return f"""
        [거시경제 뉴스]: {news_data['macro']}
        [섹터별 뉴스]: {news_data['sector']}
        [시장 리스크]: {news_data['risk']}
        """
    except Exception as e:
        print(f"⚠️ 검색 실패: {e}")
        return None

def load_weekly_reports_summary():
    """
    최근 7일간의 리포트 파일들을 읽어서 하나의 문자열로 요약합니다.
    """
    summary_text = ""
    today = datetime.date.today()
    
    print("📅 [Service] 최근 1주일간의 데이터(이유 포함) 로드 중...")
    
    # 오늘부터 과거 7일간 역순으로 확인
    found_count = 0
    for i in range(7):
        target_date = today - datetime.timedelta(days=i)
        filename = f"{REPORT_DIR}/market_report_{target_date.isoformat()}.json"
        
        if os.path.exists(filename):
            try:
                with open(filename, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    
                summary_text += f"\n=== [날짜: {data['date']}] ===\n"
                summary_text += f"- 거시경제: {data.get('macro_summary', '내용 없음')}\n"
                
                # 예: "Technology: 상승세 (AI 반도체 실적 호조로 급등)"
                sectors_details = []
                for s in data.get('sectors', []):
                    # 상태에서 괄호 등 불필요한 부분 제거 (깔끔하게)
                    short_status = s['status'].split('(')[0].strip() 
                    
                    # "섹터명: 상태 (이유)" 형식으로 조합
                    line = f"{s['name']}: {short_status} ({s.get('summary', '이유 없음')})"
                    sectors_details.append(line)
                
                # 가독성을 위해 줄바꿈으로 연결
                summary_text += "- 섹터 상세:\n" + "\n".join([f"  * {line}" for line in sectors_details]) + "\n"
                
                found_count += 1
            except Exception as e:
                print(f"⚠️ 파일 읽기 오류 ({filename}): {e}")
    
    if found_count == 0:
        return "최근 데이터가 없습니다. 오늘 데이터를 새로 생성합니다."
        
    return summary_text

async def publish_daily_report():
    print("📰 [Service] 시장 데이터 확인 및 주간 분석 시작...")
    global DAILY_BRIEFING_DATA
    global WEEKLY_CONTEXT_SUMMARY
    
    today_str = datetime.date.today().isoformat()
    today_filename = f"{REPORT_DIR}/market_report_{today_str}.json"

    # 1. [오늘] 데이터가 있는지 확인 (캐싱)
    if os.path.exists(today_filename):
        try:
            with open(today_filename, "r", encoding="utf-8") as f:
                saved_data = json.load(f)
            print(f"✅ [Cache] 오늘({today_str}) 리포트가 이미 존재합니다.")
            DAILY_BRIEFING_DATA = saved_data
        except Exception:
            pass # 읽기 실패하면 새로 생성
    
    # 2. [오늘] 데이터가 없으면 새로 생성
    if not DAILY_BRIEFING_DATA:
        print(f"🚀 [New] {today_str} 리포트 생성 시작...")
        raw_news = await fetch_news_sequentially()
        
        if raw_news:
            try:
                print("🧠 [Service] AI 분석 중...")
                report = briefing_chain.invoke({
                    "raw_news": raw_news,
                    "format_instructions": briefing_parser.get_format_instructions()
                })
                report["date"] = today_str
                
                # 날짜가 포함된 파일명으로 저장
                with open(today_filename, "w", encoding="utf-8") as f:
                    json.dump(report, f, ensure_ascii=False, indent=2)
                    
                DAILY_BRIEFING_DATA = report
                print("✅ 오늘의 리포트 발행 및 저장 완료.")
            except Exception as e:
                print(f"⚠️ 리포트 생성 실패: {e}")
                DAILY_BRIEFING_DATA = {}
        else:
            print("⚠️ 뉴스 데이터 없음.")

    # 3. [주간] 최근 7일치 데이터를 모아서 포트폴리오용 컨텍스트 생성
    #    (오늘 데이터 생성 후 실행해야 오늘 내용까지 포함됨)
    WEEKLY_CONTEXT_SUMMARY = load_weekly_reports_summary()
    print("✅ 주간 트렌드 분석 준비 완료.")


def get_briefing_data():
    return DAILY_BRIEFING_DATA

def generate_portfolio_logic(request):
    # 포트폴리오 생성 시에는 'WEEKLY_CONTEXT_SUMMARY'를 사용
    # 만약 데이터가 비어있다면 방어 로직
    context = WEEKLY_CONTEXT_SUMMARY
    if not context:
        context = "데이터 부족. 현재 시장 정보가 충분하지 않습니다."

    print(f"🔍 [Service] 포트폴리오 생성 요청 (성향: {request.risk_tolerance})")
    
    return portfolio_chain.invoke({
        "weekly_context": context,
        "age": request.age,
        "seed_money": request.seed_money,
        "risk_tolerance": request.risk_tolerance,
        "goal": request.goal,
        "format_instructions": portfolio_parser.get_format_instructions()
    })