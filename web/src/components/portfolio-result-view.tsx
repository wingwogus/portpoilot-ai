"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { generatePortfolio, normalizeRatios } from "@/lib/api/portfolio-client";
import type { PortfolioResponse, RiskTolerance, SurveyForm } from "@/lib/types";

function readSurvey(searchParams: URLSearchParams): SurveyForm | null {
  const age = Number(searchParams.get("age"));
  const seedMoney = Number(searchParams.get("seedMoney"));
  const riskTolerance = searchParams.get("riskTolerance") as RiskTolerance | null;
  const goal = searchParams.get("goal");

  if (!age || !seedMoney || !riskTolerance || !goal) {
    return null;
  }

  return {
    age,
    seedMoney,
    riskTolerance,
    goal,
  };
}

function riskWarningByType(riskTolerance: RiskTolerance): string {
  if (riskTolerance === "공격형") {
    return "고위험 자산 비중이 높아 단기 손실 폭이 커질 수 있습니다. 손절 기준과 리밸런싱 주기를 반드시 사전에 정하세요.";
  }
  if (riskTolerance === "안정형") {
    return "방어형 비중이 높아 하락 방어에는 유리하지만, 강한 상승장에서 수익률이 상대적으로 낮을 수 있습니다.";
  }
  return "균형형 포트폴리오는 평균적인 변동성을 목표로 하며, 시장 급변 시 자산별 상관관계가 높아질 수 있습니다.";
}

export default function PortfolioResultView() {
  const searchParams = useSearchParams();
  const survey = useMemo(() => readSurvey(searchParams), [searchParams]);

  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!survey) {
      setError("설문 정보가 없습니다. 설문 페이지에서 다시 진행해주세요.");
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await generatePortfolio(survey);
        setData({
          ...response,
          items: normalizeRatios(response.items),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [survey]);

  const ratioTotal = data?.items.reduce((sum, item) => sum + item.ratio, 0) ?? 0;

  return (
    <main className="container py-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h1 className="text-3xl font-bold">추천 포트폴리오 결과</h1>
            <p className="mt-2 text-slate-600">FastAPI 실연동 결과를 기반으로 ETF 비중과 이유를 제공합니다.</p>
          </div>
          <Link
            href="/survey"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            설문 다시하기
          </Link>
        </header>

        {loading ? (
          <p className="mt-7 text-slate-600">포트폴리오를 생성 중입니다...</p>
        ) : null}

        {error ? (
          <section className="mt-7 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            <h2 className="font-semibold">결과 생성 오류</h2>
            <p className="mt-2 text-sm">{error}</p>
          </section>
        ) : null}

        {data && survey ? (
          <>
            <section className="mt-7 grid gap-4 lg:grid-cols-2">
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <h2 className="text-lg font-semibold">한줄 요약</h2>
                <p className="mt-2 text-slate-700">{data.summaryComment}</p>
              </article>

              <article className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <h2 className="text-lg font-semibold text-amber-900">리스크 경고</h2>
                <p className="mt-2 text-sm text-amber-900">{riskWarningByType(survey.riskTolerance)}</p>
              </article>
            </section>

            <section className="mt-7">
              <h2 className="text-xl font-semibold">ETF 비중 ({ratioTotal}%)</h2>
              <div className="mt-3 space-y-3">
                {data.items.map((item) => (
                  <article key={item.ticker} className="rounded-xl border border-slate-200 p-4">
                    <header className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">{item.ticker}</h3>
                      <strong className="text-blue-700">{item.ratio}%</strong>
                    </header>
                    <p className="mt-2 text-sm text-slate-700">{item.summary}</p>
                    <p className="mt-2 text-sm text-slate-900">
                      <span className="font-semibold">추천 이유:</span> {item.reason}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="mt-7 rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-lg font-semibold">시장 해석</h2>
              <p className="mt-2 text-slate-700">{data.marketAnalysis}</p>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}
