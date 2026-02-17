"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { type DecisionCard } from "@/lib/api/etf-decision-client";
import { type EtfNewsCard, fetchEtfNews } from "@/lib/api/etf-news-client";

type ViewState = "loading" | "ready" | "empty" | "error";

type SectorHotNews = {
  title: string;
  url: string;
  source?: string;
  ticker: string;
};

type SectorCard = {
  sector: string;
  etfCount: number;
  hotNews: SectorHotNews[];
};

const DEFAULT_TICKERS = ["QQQ", "SPY", "SOXX", "SMH", "VTI", "TLT"];

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
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          신뢰도 {Math.round(card.confidence * 100)}%
        </span>
      </header>
      <p className="text-sm leading-6 text-slate-800">{card.conclusion}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{card.causalSummary}</p>
    </article>
  );
}

function LoadingGrid({ rows = 6, height = "h-64" }: { rows?: number; height?: string }) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3 lg:grid-cols-2">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className={`${height} animate-pulse rounded-2xl border border-slate-200 bg-white p-5`} />
      ))}
    </div>
  );
}

function normalizeToAtLeastSix(cards: EtfNewsCard[]): EtfNewsCard[] {
  const map = new Map(cards.map((c) => [c.ticker, c]));
  for (const ticker of DEFAULT_TICKERS) {
    if (!map.has(ticker)) {
      map.set(ticker, {
        ticker,
        name: "ETF",
        signal: "neutral",
        summary: "데이터 수집 중입니다. 잠시 후 다시 확인해 주세요.",
        sectors: [],
        news: [],
      });
    }
  }
  return Array.from(map.values()).slice(0, Math.max(6, map.size));
}

function buildSectorCards(cards: EtfNewsCard[]): SectorCard[] {
  const sectorMap = new Map<string, { etfs: Set<string>; hot: Map<string, SectorHotNews> }>();

  for (const card of cards) {
    const sectors = card.sectors.length > 0 ? card.sectors : ["기타"];

    for (const sector of sectors) {
      if (!sectorMap.has(sector)) {
        sectorMap.set(sector, { etfs: new Set<string>(), hot: new Map<string, SectorHotNews>() });
      }

      const bucket = sectorMap.get(sector)!;
      bucket.etfs.add(card.ticker);

      for (const news of card.news.slice(0, 3)) {
        const key = `${news.url}`;
        if (!bucket.hot.has(key)) {
          bucket.hot.set(key, {
            title: news.title,
            url: news.url,
            source: news.source,
            ticker: card.ticker,
          });
        }
      }
    }
  }

  return Array.from(sectorMap.entries())
    .map(([sector, value]) => ({
      sector,
      etfCount: value.etfs.size,
      hotNews: Array.from(value.hot.values()).slice(0, 3),
    }))
    .sort((a, b) => b.etfCount - a.etfCount)
    .slice(0, 6);
}

function SectorCardView({ card }: { card: SectorCard }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">{card.sector}</h3>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">ETF {card.etfCount}개</span>
      </header>

      <section aria-label={`${card.sector} 핫 뉴스`}>
        <h4 className="mb-2 text-sm font-semibold text-slate-800">핫 뉴스</h4>
        {card.hotNews.length > 0 ? (
          <ul className="space-y-2">
            {card.hotNews.map((news) => (
              <li key={`${card.sector}-${news.url}`}>
                <a
                  href={news.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  {news.title}
                  <span className="ml-2 text-xs text-slate-500">· {news.ticker}{news.source ? ` / ${news.source}` : ""}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">표시할 섹터 뉴스가 없습니다.</p>
        )}
      </section>
    </article>
  );
}

function EtfNewsCardView({ card }: { card: EtfNewsCard }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{card.ticker}</h3>
          <p className="text-sm text-slate-500">{card.name ?? "ETF"}</p>
        </div>
      </header>

      <section aria-label={`${card.ticker} 뉴스 요약`}>
        <h4 className="mb-2 text-sm font-semibold text-slate-800">ETF 뉴스 요약</h4>
        <p className="text-sm leading-6 text-slate-700">{card.summary}</p>
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

export function HomeDashboard() {
  const [newsState, setNewsState] = useState<ViewState>("loading");
  const [cards, setCards] = useState<EtfNewsCard[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = async () => {
    setNewsState("loading");
    setErrorMessage(null);

    try {
      const newsResult = await fetchEtfNews(DEFAULT_TICKERS);
      const normalized = normalizeToAtLeastSix(newsResult);
      setCards(normalized);
      setNewsState(normalized.length > 0 ? "ready" : "empty");
    } catch (error) {
      setNewsState("error");
      setErrorMessage(error instanceof Error ? error.message : "데이터를 불러오지 못했습니다.");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const updatedCount = useMemo(() => cards.filter((card) => card.updatedAt).length, [cards]);
  const sectorCards = useMemo(() => buildSectorCards(cards), [cards]);

  return (
    <section aria-labelledby="etf-dashboard-title" className="mt-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="etf-dashboard-title" className="text-2xl font-semibold text-slate-900">
            시장 브리핑 홈
          </h2>
          <p className="mt-1 text-sm text-slate-600">섹터별 핫뉴스와 ETF별 뉴스 요약을 한 번에 확인하세요.</p>
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

      {newsState === "loading" && (
        <>
          <LoadingGrid rows={3} height="h-56" />
          <div className="mt-6">
            <LoadingGrid rows={6} height="h-72" />
          </div>
        </>
      )}

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
          <section aria-labelledby="sector-hot-news-title">
            <h3 id="sector-hot-news-title" className="mb-3 text-xl font-semibold text-slate-900">
              섹터별 핫 뉴스
            </h3>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {sectorCards.map((card) => (
                <SectorCardView key={`sector-${card.sector}`} card={card} />
              ))}
            </div>
          </section>

          <section className="mt-8" aria-labelledby="etf-news-title">
            <h3 id="etf-news-title" className="mb-3 text-xl font-semibold text-slate-900">
              ETF별 뉴스
            </h3>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {cards.slice(0, Math.max(6, cards.length)).map((card) => (
                <EtfNewsCardView key={`etf-${card.ticker}`} card={card} />
              ))}
            </div>
          </section>
        </>
      )}

      <aside className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-900">다음 단계</h3>
        <p className="mt-1 text-sm text-slate-600">티커 단위 심화 분석은 ETF 브리프 페이지에서 확인할 수 있습니다.</p>
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
