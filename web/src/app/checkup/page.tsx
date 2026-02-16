"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MobileShell } from "@/components/mobile-shell";
import { Card, Label } from "@/components/ui";
import { mockReasonApi } from "@/lib/api/mock-client";

export default function CheckupPage() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [concern, setConcern] = useState("");
  const [horizonWeeks, setHorizonWeeks] = useState(4);
  const [loading, setLoading] = useState(false);

  const canSubmit = goal.trim().length > 3 && concern.trim().length > 5;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    const payload = { goal: goal.trim(), concern: concern.trim(), horizonWeeks };
    const { jobId } = await mockReasonApi.submitCheckup(payload);
    window.localStorage.setItem(`checkup:${jobId}`, JSON.stringify(payload));
    router.push(`/processing?jobId=${jobId}`);
  };

  return (
    <MobileShell title="포트폴리오 체크업" subtitle="PC 기준 입력 화면입니다. 목표/리스크를 입력하면 빠르게 진단 결과를 생성합니다.">
      <Card>
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <div className="md:col-span-2">
            <Label>이번 투자 목표</Label>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-indigo-300 focus:ring"
              placeholder="예: 3개월 내 변동성 줄이면서 수익률 개선"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <Label>가장 걱정되는 리스크</Label>
            <textarea
              className="min-h-28 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-indigo-300 focus:ring"
              placeholder="예: 기술주 쏠림이 심하고 하락장 대응이 불안함"
              value={concern}
              onChange={(e) => setConcern(e.target.value)}
            />
          </div>

          <div>
            <Label>의사결정 기간(주)</Label>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-indigo-300 focus:ring"
              type="number"
              min={1}
              max={24}
              value={horizonWeeks}
              onChange={(e) => setHorizonWeeks(Number(e.target.value))}
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {loading ? "진단 시작 중..." : "Reason 체크업 실행"}
            </button>
          </div>
        </form>
      </Card>
    </MobileShell>
  );
}
