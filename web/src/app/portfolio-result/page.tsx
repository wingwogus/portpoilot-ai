import type { Metadata } from "next";
import { Suspense } from "react";
import PortfolioResultView from "@/components/portfolio-result-view";

export const metadata: Metadata = {
  title: "추천 포트폴리오 결과",
  description:
    "설문 응답을 바탕으로 생성된 ETF 비중, 추천 이유, 리스크 경고, 한줄 요약을 확인하세요.",
};

export default function PortfolioResultPage() {
  return (
    <>
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <strong className="text-lg">PortPilot AI</strong>
          <nav aria-label="주요 메뉴" className="text-sm text-slate-600">
            포트폴리오 결과
          </nav>
        </div>
      </header>
      <Suspense fallback={<main className="container py-10 text-slate-600">결과를 불러오는 중입니다...</main>}>
        <PortfolioResultView />
      </Suspense>
    </>
  );
}
