import type { Metadata } from "next";
import DecisionBriefView from "@/components/decision-brief-view";

export const metadata: Metadata = {
  title: "ETF 의사결정 브리프",
  description: "ETF 티커를 직접 입력해 인과 기반 의사결정 브리프와 핵심 이벤트를 조회합니다.",
  alternates: {
    canonical: "/decision-brief",
  },
};

export default function DecisionBriefPage() {
  return (
    <>
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <strong className="text-lg">PortPilot AI</strong>
          <nav aria-label="주요 메뉴" className="text-sm text-slate-600">
            ETF 의사결정 브리프
          </nav>
        </div>
      </header>
      <DecisionBriefView />
    </>
  );
}
