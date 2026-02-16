"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MobileShell } from "@/components/mobile-shell";
import { Card } from "@/components/ui";
import { mockReasonApi } from "@/lib/api/mock-client";
import type { ReasonResult } from "@/lib/types";

function riskLabel(risk: ReasonResult["risk"]) {
  if (risk === "high") return "높음";
  if (risk === "medium") return "보통";
  return "낮음";
}

function ResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId") ?? "demo";
  const [result, setResult] = useState<ReasonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setError(null);

    mockReasonApi
      .getResult(jobId)
      .then((data) => {
        if (mounted) setResult(data);
      })
      .catch(() => {
        if (mounted) setError("결과를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      });

    return () => {
      mounted = false;
    };
  }, [jobId]);

  if (error) {
    return (
      <MobileShell title="진단 결과" subtitle="결과를 확인하는 중 문제가 발생했습니다.">
        <Card>
          <p className="text-sm text-rose-600">{error}</p>
          <button
            type="button"
            onClick={() => router.push(`/processing?jobId=${jobId}`)}
            className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
          >
            다시 시도하기
          </button>
        </Card>
      </MobileShell>
    );
  }

  if (!result) {
    return <MobileShell title="진단 결과" subtitle="결과를 불러오는 중입니다..." />;
  }

  return (
    <MobileShell title="진단 결과" subtitle="PC 리뷰 기준으로 한눈에 볼 수 있도록 구성했습니다.">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        <Card>
          <p className="text-sm text-slate-500">신뢰 점수</p>
          <p className="text-4xl font-semibold">{result.score}/100</p>
          <p className="mt-2 text-sm text-slate-600">리스크: {riskLabel(result.risk)}</p>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold">강점</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {result.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold">블라인드 스팟</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {result.blindSpots.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      </section>

      <Card>
        <h2 className="text-sm font-semibold">요약</h2>
        <p className="mt-2 text-sm text-slate-700">{result.summary}</p>
        <p className="mt-3 text-sm text-slate-700">개선 제안: {result.recommendation}</p>
      </Card>

      <nav aria-label="다음 작업" className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Link
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-center text-sm font-medium"
          href={`/recompose?jobId=${jobId}`}
        >
          재구성 제안 보기
        </Link>
        <Link className="rounded-xl bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white" href={`/briefing?jobId=${jobId}`}>
          브리핑 생성
        </Link>
      </nav>
    </MobileShell>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={<MobileShell title="진단 결과" subtitle="결과를 불러오는 중입니다..." />}>
      <ResultContent />
    </Suspense>
  );
}
