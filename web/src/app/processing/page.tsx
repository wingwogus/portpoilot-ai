"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MobileShell } from "@/components/mobile-shell";
import { Card } from "@/components/ui";
import { mockReasonApi } from "@/lib/api/mock-client";

type ViewState = "processing" | "timeout" | "failed";

function ProcessingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");
  const checkupId = searchParams.get("checkupId");
  const [viewState, setViewState] = useState<ViewState>("processing");
  const [checking, setChecking] = useState(false);

  const checkJobStatus = async () => {
    if (!jobId || checking) return;

    setChecking(true);
    try {
      const { status, checkupId: resolvedCheckupId } = await mockReasonApi.getJobStatus(jobId);

      if (status === "completed") {
        const targetCheckupId = resolvedCheckupId ?? checkupId;
        router.replace(targetCheckupId ? `/result?jobId=${jobId}&checkupId=${targetCheckupId}` : `/result?jobId=${jobId}`);
        return;
      }

      if (status === "failed") {
        setViewState("failed");
      }
    } catch {
      setViewState("failed");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!jobId) {
      setViewState("failed");
      return;
    }

    let disposed = false;

    const run = async () => {
      const { status, checkupId: resolvedCheckupId } = await mockReasonApi.getJobStatus(jobId);
      if (disposed) return;

      if (status === "completed") {
        const targetCheckupId = resolvedCheckupId ?? checkupId;
        router.replace(targetCheckupId ? `/result?jobId=${jobId}&checkupId=${targetCheckupId}` : `/result?jobId=${jobId}`);
        return;
      }

      if (status === "failed") {
        setViewState("failed");
        return;
      }

      const interval = window.setInterval(async () => {
        try {
          const next = await mockReasonApi.getJobStatus(jobId);
          if (disposed) return;

          if (next.status === "completed") {
            window.clearInterval(interval);
            const targetCheckupId = next.checkupId ?? checkupId;
            router.replace(targetCheckupId ? `/result?jobId=${jobId}&checkupId=${targetCheckupId}` : `/result?jobId=${jobId}`);
            return;
          }

          if (next.status === "failed") {
            window.clearInterval(interval);
            setViewState("failed");
          }
        } catch {
          window.clearInterval(interval);
          if (!disposed) setViewState("failed");
        }
      }, 300);

      const timeout = window.setTimeout(() => {
        window.clearInterval(interval);
        if (!disposed) setViewState("timeout");
      }, 7000);

      return () => {
        window.clearInterval(interval);
        window.clearTimeout(timeout);
      };
    };

    let cleanup: (() => void) | void;
    run()
      .then((fn) => {
        cleanup = fn;
      })
      .catch(() => {
        if (!disposed) setViewState("failed");
      });

    return () => {
      disposed = true;
      if (cleanup) cleanup();
    };
  }, [jobId, checkupId, router]);

  return (
    <MobileShell title="분석 진행 중" subtitle="입력값을 분석해 점수/강점/리스크를 계산하고 있습니다.">
      <Card>
        <div className="space-y-3">
          {viewState === "processing" ? (
            <>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-indigo-600" />
              </div>
              <p className="text-sm text-slate-600">요약, 강점, 블라인드 스팟, 개선 제안을 생성하는 중입니다...</p>
            </>
          ) : null}

          {viewState === "timeout" ? (
            <>
              <p className="text-sm text-amber-700">분석이 예상보다 오래 걸리고 있습니다. 지금 다시 확인해 주세요.</p>
              <button
                type="button"
                onClick={checkJobStatus}
                disabled={checking || !jobId}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                {checking ? "다시 확인 중..." : "지금 다시 확인"}
              </button>
            </>
          ) : null}

          {viewState === "failed" ? (
            <>
              <p className="text-sm text-rose-600">결과 생성에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={checkJobStatus}
                  disabled={checking || !jobId}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {checking ? "재시도 중..." : "다시 확인"}
                </button>
                <Link className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white" href="/checkup">
                  체크업으로 돌아가기
                </Link>
              </div>
            </>
          ) : null}

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
