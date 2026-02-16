"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MobileShell } from "@/components/mobile-shell";
import { Card } from "@/components/ui";
import { mockReasonApi } from "@/lib/api/mock-client";
import type { ReasonResult } from "@/lib/types";

function ResultContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId") ?? "demo";
  const [result, setResult] = useState<ReasonResult | null>(null);

  useEffect(() => {
    let mounted = true;
    mockReasonApi.getResult(jobId).then((data) => {
      if (mounted) setResult(data);
    });
    return () => {
      mounted = false;
    };
  }, [jobId]);

  if (!result) {
    return <MobileShell title="Result" subtitle="Loading outcome…" />;
  }

  return (
    <MobileShell title="Result" subtitle="Your fast Reason readout is ready.">
      <Card>
        <p className="text-sm text-slate-500">Confidence score</p>
        <p className="text-3xl font-semibold">{result.score}/100</p>
        <p className="mt-1 text-sm capitalize text-slate-600">Risk: {result.risk}</p>
        <p className="mt-3 text-sm text-slate-700">{result.summary}</p>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold">Strengths</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {result.strengths.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold">Blind spots</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {result.blindSpots.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-slate-700">Recommendation: {result.recommendation}</p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Link
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-center text-sm font-medium"
          href={`/recompose?jobId=${jobId}`}
        >
          Recompose
        </Link>
        <Link
          className="rounded-xl bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white"
          href={`/briefing?jobId=${jobId}`}
        >
          Briefing
        </Link>
      </div>
    </MobileShell>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={<MobileShell title="Result" subtitle="Loading outcome…" />}>
      <ResultContent />
    </Suspense>
  );
}
