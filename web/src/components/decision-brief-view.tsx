"use client";

import { FormEvent, useMemo, useState } from "react";
import { DecisionCardView } from "@/components/home-dashboard";
import { type DecisionCard, fetchEtfDecisionBrief } from "@/lib/api/etf-decision-client";

const DEFAULT_TICKERS = "QQQ,SPY,SMH";

function normalizeTickers(raw: string): string[] {
  const seen = new Set<string>();
  return raw
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter((item) => /^[A-Z]{1,10}$/.test(item))
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    })
    .slice(0, 8);
}

export default function DecisionBriefView() {
  const [tickerInput, setTickerInput] = useState(DEFAULT_TICKERS);
  const [cards, setCards] = useState<DecisionCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<string[]>([]);

  const helper = useMemo(() => {
    const parsed = normalizeTickers(tickerInput);
    if (parsed.length === 0) return "티커를 1개 이상 입력하세요. 예: QQQ,SPY,SMH";
    return `요청 예정 티커: ${parsed.join(", ")}`;
  }, [tickerInput]);

  const run = async (event?: FormEvent) => {
    event?.preventDefault();
    const tickers = normalizeTickers(tickerInput);
    setSubmitted(tickers);

    if (tickers.length === 0) {
      setCards([]);
      setError("유효한 티커가 없습니다. 영문 티커를 쉼표로 구분해 입력해 주세요.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await fetchEtfDecisionBrief(tickers);
      setCards(result);
    } catch (e) {
      setCards([]);
      setError(e instanceof Error ? e.message : "의사결정 브리프를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container py-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <header className="border-b border-slate-100 pb-5">
          <h1 className="text-3xl font-bold tracking-tight">ETF 의사결정 브리프 조회</h1>
          <p className="mt-2 text-slate-600">티커를 직접 입력해 인과 기반 결론, 핵심 이벤트, 시그널을 조회합니다.</p>
        </header>

        <form className="mt-6" onSubmit={(e) => void run(e)}>
          <label htmlFor="ticker-input" className="mb-2 block text-sm font-semibold text-slate-700">
            ETF 티커 (쉼표 구분)
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="ticker-input"
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value)}
              placeholder="예: QQQ,SPY,SMH"
              className="min-w-[260px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-300 placeholder:text-slate-400 focus:ring"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? "조회 중..." : "브리프 조회"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">{helper}</p>
        </form>

        {error ? (
          <section className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
            <h2 className="font-semibold">조회 오류</h2>
            <p className="mt-1 text-sm">{error}</p>
          </section>
        ) : null}

        {!loading && !error && submitted.length > 0 && cards.length === 0 ? (
          <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
            <h2 className="font-semibold">조회 결과 없음</h2>
            <p className="mt-1 text-sm">입력한 티커({submitted.join(", ")})에 대한 브리프 데이터가 없습니다.</p>
          </section>
        ) : null}

        {loading ? (
          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, idx) => (
              <div key={idx} className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />
            ))}
          </div>
        ) : null}

        {!loading && cards.length > 0 ? (
          <section className="mt-6" aria-label="ETF 의사결정 브리프 결과">
            <h2 className="text-xl font-semibold text-slate-900">브리프 결과 ({cards.length}건)</h2>
            <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
              {cards.map((card) => (
                <DecisionCardView key={`decision-page-${card.ticker}`} card={card} />
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
