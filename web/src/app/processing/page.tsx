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
    <MobileShell title="분석 진행 중" subtitle="입력값을 분석해 점수/강점/리스크를 계산하고 있습니다.">
      <Card>
        <div className="space-y-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-indigo-600" />
          </div>
          <p className="text-sm text-slate-600">요약, 강점, 블라인드 스팟, 개선 제안을 생성하는 중입니다...</p>
          {!jobId ? <p className="text-sm text-rose-600">jobId가 없습니다. 체크업 화면으로 돌아가 주세요.</p> : null}
        </div>
      </Card>
    </MobileShell>
  );
}

export default function ProcessingPage() {
  return (
    <Suspense fallback={<MobileShell title="분석 진행 중" subtitle="결과를 준비하고 있습니다..." />}>
      <ProcessingContent />
    </Suspense>
  );
}
