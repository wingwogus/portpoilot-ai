"use client";

import { useState } from "react";
import { MobileShell } from "@/components/mobile-shell";
import { Card, Label } from "@/components/ui";
import { mockReasonApi } from "@/lib/api/mock-client";
import type { RecomposeResult } from "@/lib/types";

export default function RecomposePage() {
  const [tone, setTone] = useState<"balanced" | "optimistic" | "conservative">("balanced");
  const [focus, setFocus] = useState("Execution risk");
  const [result, setResult] = useState<RecomposeResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const data = await mockReasonApi.recompose({ tone, focus });
    setResult(data);
    setLoading(false);
  };

  return (
    <MobileShell title="Recompose" subtitle="Regenerate framing with a selected tone and focus.">
      <Card>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <Label>Tone</Label>
            <select
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={tone}
              onChange={(e) => setTone(e.target.value as typeof tone)}
            >
              <option value="balanced">Balanced</option>
              <option value="optimistic">Optimistic</option>
              <option value="conservative">Conservative</option>
            </select>
          </div>
          <div>
            <Label>Focus area</Label>
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
            />
          </div>
          <button className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white" type="submit">
            {loading ? "Reframing…" : "Generate recomposed output"}
          </button>
        </form>
      </Card>

      {result ? (
        <Card>
          <p className="text-sm text-slate-700">{result.reframedSummary}</p>
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
