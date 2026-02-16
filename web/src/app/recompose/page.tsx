"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MobileShell } from "@/components/mobile-shell";
import { Card, Label } from "@/components/ui";
import { mockReasonApi } from "@/lib/api/mock-client";
import type { RecomposeResult } from "@/lib/types";

function RecomposeContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId") ?? undefined;
  const checkupId = searchParams.get("checkupId") ?? undefined;
  const [tone, setTone] = useState<"balanced" | "optimistic" | "conservative">("balanced");
  const [focus, setFocus] = useState("전환율 개선");
  const [result, setResult] = useState<RecomposeResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const data = await mockReasonApi.recompose({ tone, focus, jobId, checkupId });
    setResult(data);
    setLoading(false);
  };

  return (
    <MobileShell title="재구성 제안" subtitle="톤과 포커스를 바꿔 실행 가능한 문장으로 다시 생성합니다.">
      <Card>
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div>
            <Label>톤</Label>
            <select
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={tone}
              onChange={(e) => setTone(e.target.value as typeof tone)}
            >
              <option value="balanced">균형형</option>
              <option value="optimistic">공격형</option>
              <option value="conservative">보수형</option>
            </select>
          </div>
          <div>
            <Label>포커스 영역</Label>
            <input className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={focus} onChange={(e) => setFocus(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <button className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white" type="submit">
              {loading ? "재생성 중..." : "재구성 결과 생성"}
            </button>
          </div>
        </form>
      </Card>

      {result ? (
        <Card>
          <h2 className="text-sm font-semibold">재구성 요약</h2>
          <p className="mt-2 text-sm text-slate-700">{result.reframedSummary}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {result.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </Card>
      ) : null}
    </MobileShell>
  );
}

export default function RecomposePage() {
  return (
    <Suspense fallback={<MobileShell title="재구성 제안" subtitle="재구성 준비 중..." />}>
      <RecomposeContent />
    </Suspense>
  );
}
