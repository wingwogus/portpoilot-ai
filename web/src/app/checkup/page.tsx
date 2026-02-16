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
    <MobileShell
      title="Checkup"
      subtitle="Capture your objective and the main uncertainty. We’ll generate a fast Reason readout."
    >
      <Card>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <Label>What are you trying to achieve?</Label>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-indigo-300 focus:ring"
              placeholder="e.g., Launch paid beta in one month"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>

          <div>
            <Label>Main concern / risk</Label>
            <textarea
              className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-indigo-300 focus:ring"
              placeholder="What might fail?"
              value={concern}
              onChange={(e) => setConcern(e.target.value)}
            />
          </div>

          <div>
            <Label>Decision horizon (weeks)</Label>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-indigo-300 focus:ring"
              type="number"
              min={1}
              max={24}
              value={horizonWeeks}
              onChange={(e) => setHorizonWeeks(Number(e.target.value))}
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            {loading ? "Starting…" : "Run Reason Checkup"}
          </button>
        </form>
      </Card>
    </MobileShell>
  );
}
