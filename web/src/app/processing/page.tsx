"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MobileShell } from "@/components/mobile-shell";
import { Card } from "@/components/ui";

function ProcessingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");

  useEffect(() => {
    if (!jobId) return;

    const timer = window.setTimeout(() => {
      router.replace(`/result?jobId=${jobId}`);
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [jobId, router]);

  return (
    <MobileShell title="Processing" subtitle="Analyzing your inputs and preparing decision signal.">
      <Card>
        <div className="space-y-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-indigo-600" />
          </div>
          <p className="text-sm text-slate-600">Generating summary, strengths, blind spots, and recommendation…</p>
          {!jobId ? <p className="text-sm text-rose-600">Missing job id. Return to checkup.</p> : null}
        </div>
      </Card>
    </MobileShell>
  );
}

export default function ProcessingPage() {
  return (
    <Suspense fallback={<MobileShell title="Processing" subtitle="Preparing your result…" />}>
      <ProcessingContent />
    </Suspense>
  );
}
