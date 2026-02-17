"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { type DecisionCard, fetchEtfDecisionBrief } from "@/lib/api/etf-decision-client";
import { type EtfNewsCard, fetchEtfNews } from "@/lib/api/etf-news-client";

type ViewState = "loading" | "ready" | "empty" | "error";

type UnifiedCard = {
  ticker: string;
  name?: string;
  summary: string;
  updatedAt?: string;
  news: EtfNewsCard["news"];
  signal: "bullish" | "neutral" | "bearish";
  decision?: DecisionCard;
};

const signalLabel = {
  bullish: "강세 시그널",
  neutral: "중립 시그널",
  bearish: "약세 시그널",
} as const;

const signalClass = {
  bullish: "bg-emerald-50 text-emerald-700 border-emerald-200",
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  bearish: "bg-rose-50 text-rose-700 border-rose-200",
} as const;

function formatUpdatedAt(value?: string) {
  if (!value) return "업데이트 시각 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function DecisionCardView({ card }: { card: DecisionCard }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">{card.ticker}</h3>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${signalClass[card.signal]}`}
        >
          {signalLabel[card.signal]} · 신뢰도 {Math.round(card.confidence * 100)}%
        </span>
      </header>

      <p className="text-sm leading-6 text-slate-800">{card.conclusion}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{card.causalSummary}</p>

      {card.keyEvents.length > 0 ? (
        <section className="mt-4" aria-label={`${card.ticker} 핵심 이벤트`}>
          <h4 className="mb-2 text-sm font-semibold text-slate-800">핵심 이벤트</h4>
          <ul className="space-y-2">
            {card.keyEvents.map((event) => (
              <li key={`${card.ticker}-${event.sourceLink}`} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <p className="font-medium">{event.event}</p>
                <p className="mt-1 text-xs text-slate-500">{event.marketReaction}</p>
                <a
                  href={event.sourceLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex text-xs font-medium text-blue-700 hover:text-blue-800"
                >
                  {event.source} 원문 보기
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

function UnifiedEtfCard({ card }: { card: UnifiedCard }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{card.ticker}</h3>
          <p className="text-sm text-slate-500">{card.name ?? "ETF"}</p>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${signalClass[card.signal]}`}
        >
          {signalLabel[card.signal]}
        </span>
      </header>

      <section aria-label={`${card.ticker} 뉴스 요약`}>
        <h4 className="mb-2 text-sm font-semibold text-slate-800">카드뉴스 요약</h4>
        <p className="text-sm leading-6 text-slate-700">{card.summary}</p>
      </section>

      <section className="mt-4" aria-label={`${card.ticker} 의사결정 브리프`}>
        <h4 className="mb-2 text-sm font-semibold text-slate-800">의사결정 브리프</h4>
        {card.decision ? (
          <>
            <p className="text-sm leading-6 text-slate-800">{card.decision.conclusion}</p>
            <p className="mt-1 text-xs text-slate-500">신뢰도 {Math.round(card.decision.confidence * 100)}%</p>
          </>
        ) : (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">브리프 데이터가 아직 준비되지 않았습니다.</p>
        )}
      </section>

      <section className="mt-4" aria-label={`${card.ticker} 관련 뉴스`}>
        <h4 className="mb-2 text-sm font-semibold text-slate-800">연관 뉴스</h4>
        {card.news.length > 0 ? (
          <ul className="space-y-2">
            {card.news.slice(0, 3).map((news) => (
              <li key={`${card.ticker}-${news.url}`}>
                <a
                  href={news.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  {news.title}
                  {news.source ? <span className="ml-2 text-xs text-slate-500">· {news.source}</span> : null}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">표시할 뉴스가 없습니다.</p>
        )}
      </section>

      <footer className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
        업데이트: <time dateTime={card.updatedAt}>{formatUpdatedAt(card.updatedAt)}</time>
      </footer>
    </article>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3 lg:grid-cols-2">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx} className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white p-5" />
      ))}
    </div>
  );
}

function mergeByTicker(newsCards: EtfNewsCard[], decisionCards: DecisionCard[]): UnifiedCard[] {
  const decisionMap = new Map(decisionCards.map((item) => [item.ticker, item]));
  const merged = new Map<string, UnifiedCard>();

  for (const news of newsCards) {
    const decision = decisionMap.get(news.ticker);
    merged.set(news.ticker, {
      ticker: news.ticker,
      name: news.name,
      summary: news.summary,
      updatedAt: news.updatedAt,
      news: news.news,
      signal: decision?.signal ?? news.signal,
      decision,
    });
  }

  for (const decision of decisionCards) {
    if (merged.has(decision.ticker)) continue;
    merged.set(decision.ticker, {
      ticker: decision.ticker,
      summary: "뉴스 요약 정보가 없습니다.",
      news: [],
      signal: decision.signal,
      decision,
    });
  }

  return Array.from(merged.values());
}

export function HomeDashboard() {
  const [newsState, setNewsState] = useState<ViewState>("loading");
  const [decisionState, setDecisionState] = useState<ViewState>("loading");
  const [cards, setCards] = useState<EtfNewsCard[]>([]);
  const [decisionCards, setDecisionCards] = useState<DecisionCard[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = async () => {
    setNewsState("loading");
    setDecisionState("loading");
    setErrorMessage(null);

    try {
      const newsResult = await fetchEtfNews();
      setCards(newsResult);
      setNewsState(newsResult.length > 0 ? "ready" : "empty");

      const tickers = Array.from(new Set(newsResult.map((card) => card.ticker))).slice(0, 8);
      if (tickers.length === 0) {
        setDecisionCards([]);
        setDecisionState("empty");
        return;
      }

      try {
        const decisionResult = await fetchEtfDecisionBrief(tickers);
        setDecisionCards(decisionResult);
        setDecisionState(decisionResult.length > 0 ? "ready" : "empty");
      } catch (error) {
        setDecisionCards([]);
        setDecisionState("error");
        setErrorMessage(error instanceof Error ? error.message : "의사결정 브리프 로딩 중 오류가 발생했습니다.");
      }
    } catch (error) {
      setNewsState("error");
      setDecisionState("empty");
      setErrorMessage(error instanceof Error ? error.message : "데이터를 불러오지 못했습니다.");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const updatedCount = useMemo(() => cards.filter((card) => card.updatedAt).length, [cards]);
  const unifiedCards = useMemo(() => mergeByTicker(cards, decisionCards), [cards, decisionCards]);

  return (
    <section aria-labelledby="etf-dashboard-title" className="mt-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="etf-dashboard-title" className="text-2xl font-semibold text-slate-900">
            ETF 통합 브리핑
          </h2>
          <p className="mt-1 text-sm text-slate-600">카드뉴스 + 의사결정 브리프를 ETF별 1카드로 통합해 제공합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">업데이트 보유 {updatedCount}개</span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            새로고침
          </button>
        </div>
      </header>

      {newsState === "loading" && <LoadingGrid />}

      {newsState === "error" && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          <p className="font-semibold">뉴스 데이터를 불러오지 못했습니다.</p>
          <p className="mt-1 text-sm">{errorMessage ?? "잠시 후 다시 시도해 주세요."}</p>
        </div>
      )}

      {newsState === "empty" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center">
          <p className="text-base font-semibold text-slate-800">표시할 ETF 뉴스가 없습니다.</p>
          <p className="mt-1 text-sm text-slate-500">수집 데이터가 준비되면 자동으로 노출됩니다.</p>
        </div>
      )}

      {newsState === "ready" && (
        <>
          {decisionState === "error" && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              의사결정 브리프 API 연결에 실패했습니다. 뉴스 기반 카드만 우선 표시합니다.
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {unifiedCards.map((card) => (
              <UnifiedEtfCard key={`unified-${card.ticker}`} card={card} />
            ))}
          </div>
        </>
      )}

      <aside className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-900">다음 단계</h3>
        <p className="mt-1 text-sm text-slate-600">티커 단위로 더 깊게 보고 싶으시면 전용 브리프 페이지를 이용해 주세요.</p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Link href="/decision-brief" className="inline-flex text-sm font-semibold text-blue-700 hover:text-blue-800">
            ETF 브리프 바로가기 →
          </Link>
          <Link href="/survey" className="inline-flex text-sm font-semibold text-slate-700 hover:text-slate-900">
            설문 시작하기 →
          </Link>
        </div>
      </aside>
    </section>
  );
}
