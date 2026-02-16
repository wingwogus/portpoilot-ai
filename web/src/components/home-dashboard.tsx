"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { type EtfNewsCard, fetchEtfNews } from "@/lib/api/etf-news-client";

type ViewState = "loading" | "ready" | "empty" | "error";

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

function EtfCard({ card }: { card: EtfNewsCard }) {
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

      <p className="mb-4 text-sm leading-6 text-slate-700">{card.summary}</p>

      <section aria-label={`${card.ticker} 관련 뉴스`}>
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
        <div key={idx} className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white p-5" />
      ))}
    </div>
  );
}

export function HomeDashboard() {
  const [state, setState] = useState<ViewState>("loading");
  const [cards, setCards] = useState<EtfNewsCard[]>([]);

  const refresh = async () => {
    setState("loading");
    try {
      const result = await fetchEtfNews();
      setCards(result);
      setState(result.length > 0 ? "ready" : "empty");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const updatedCount = useMemo(() => cards.filter((card) => card.updatedAt).length, [cards]);

  return (
    <section aria-labelledby="etf-dashboard-title" className="mt-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="etf-dashboard-title" className="text-2xl font-semibold text-slate-900">
            ETF 뉴스 대시보드
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            ETF별 최신 시그널과 관련 뉴스를 한눈에 확인하세요.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            업데이트 보유 {updatedCount}개
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            새로고침
          </button>
        </div>
      </header>

      {state === "loading" && <LoadingGrid />}

      {state === "error" && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          <p className="font-semibold">데이터를 불러오지 못했습니다.</p>
          <p className="mt-1 text-sm">잠시 후 다시 시도해 주세요.</p>
        </div>
      )}

      {state === "empty" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center">
          <p className="text-base font-semibold text-slate-800">표시할 ETF 뉴스가 없습니다.</p>
          <p className="mt-1 text-sm text-slate-500">수집 데이터가 준비되면 자동으로 노출됩니다.</p>
        </div>
      )}

      {state === "ready" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <EtfCard key={card.ticker} card={card} />
          ))}
        </div>
      )}

      <aside className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-900">다음 단계</h3>
        <p className="mt-1 text-sm text-slate-600">맞춤 ETF 비중 추천이 필요하면 설문을 진행해 주세요.</p>
        <Link href="/survey" className="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-800">
          설문 시작하기 →
        </Link>
      </aside>
    </section>
  );
}
