import type { Metadata } from "next";
import { HomeDashboard } from "@/components/home-dashboard";

export const metadata: Metadata = {
  title: "홈 대시보드",
  description: "ETF 카드별 최신 시그널, 요약, 연관 뉴스를 한 화면에서 확인하는 PortPilot AI 홈 대시보드",
  alternates: {
    canonical: "/",
  },
};

export default function HomePage() {
  return (
    <main>
      <header className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="container py-14">
          <p className="text-sm font-semibold text-blue-700">PORTPILOT AI</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">ETF 뉴스 인텔리전스 홈</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-700">
            시장 신호, 핵심 요약, 연관 뉴스 링크를 ETF 카드 단위로 제공합니다. 데스크톱 중심 레이아웃으로 빠르게 스캔하고, 모바일에서도
            동일한 정보 밀도를 유지합니다.
          </p>
        </div>
      </header>

      <div className="container pb-14">
        <HomeDashboard />
      </div>
    </main>
  );
}
