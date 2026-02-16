"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MobileShell } from "@/components/mobile-shell";
import { Card } from "@/components/ui";
import { mockReasonApi } from "@/lib/api/mock-client";
import type { BriefingResult } from "@/lib/types";

function BriefingContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId") ?? "demo";
  const [briefing, setBriefing] = useState<BriefingResult | null>(null);

  useEffect(() => {
    mockReasonApi.getBriefing(jobId).then(setBriefing);
  }, [jobId]);

  if (!briefing) {
    return <MobileShell title="Briefing" subtitle="Building your meeting-ready summary…" />;
  }

  return (
    <MobileShell title="Briefing" subtitle="Quick talking points for stakeholders.">
      <Card>
        <h2 className="text-base font-semibold">{briefing.headline}</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
          {briefing.talkingPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">{briefing.caveat}</p>
      </Card>

      <Link href="/checkup" className="block rounded-xl border border-slate-300 bg-white px-4 py-2 text-center text-sm font-medium">
        Start another checkup
      </Link>
    </MobileShell>
  );
}

export default function BriefingPage() {
  return (
    <Suspense fallback={<MobileShell title="Briefing" subtitle="Preparing summary…" />}>
      <BriefingContent />
    </Suspense>
  );
}
