import type { Metadata } from "next";
import SurveyForm from "@/components/survey-form";

export const metadata: Metadata = {
  title: "투자 성향 설문",
  description:
    "5문항 내외 설문으로 투자 성향을 파악하고 ETF 포트폴리오 추천 결과 페이지로 이동합니다.",
};

export default function SurveyPage() {
  return (
    <>
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <strong className="text-lg">PortPilot AI</strong>
          <nav aria-label="주요 메뉴" className="text-sm text-slate-600">
            ETF 추천 설문
          </nav>
        </div>
      </header>

      <main className="container py-10">
        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
            <h1 className="text-3xl font-bold tracking-tight">투자 성향 설문</h1>
            <p className="mt-2 text-slate-600">
              5문항 내외 입력으로 맞춤 ETF 포트폴리오를 생성합니다. (데스크톱 최적화)
            </p>
            <SurveyForm />
          </article>

          <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">입력 가이드</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>설문은 한국어 기준으로 작성되어 있습니다.</li>
              <li>위험 성향은 결과 비중에 직접 반영됩니다.</li>
              <li>모든 금액은 원화 숫자만 입력해 주세요.</li>
              <li>결과는 투자 권유가 아닌 참고 정보입니다.</li>
            </ul>
          </aside>
        </section>
      </main>
    </>
  );
}
