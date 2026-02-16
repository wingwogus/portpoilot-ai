"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const riskOptions = ["안정형", "중립형", "공격형"] as const;

export default function SurveyForm() {
  const router = useRouter();
  const [age, setAge] = useState("30");
  const [seedMoney, setSeedMoney] = useState("10000000");
  const [riskTolerance, setRiskTolerance] = useState<(typeof riskOptions)[number]>("중립형");
  const [goal, setGoal] = useState("5년 이상 장기 투자로 자산 성장");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedAge = Number(age);
    const parsedSeed = Number(seedMoney);

    if (!Number.isFinite(parsedAge) || parsedAge < 19 || parsedAge > 100) {
      setError("나이는 19~100 사이 숫자로 입력해주세요.");
      return;
    }

    if (!Number.isFinite(parsedSeed) || parsedSeed < 100000) {
      setError("투자 가능 금액은 최소 100,000원 이상으로 입력해주세요.");
      return;
    }

    if (goal.trim().length < 8) {
      setError("투자 목표를 8자 이상으로 입력해주세요.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    const params = new URLSearchParams({
      age: String(parsedAge),
      seedMoney: String(parsedSeed),
      riskTolerance,
      goal: goal.trim(),
    });

    router.push(`/portfolio-result?${params.toString()}`);
  };

  return (
    <form className="mt-8 space-y-5" onSubmit={onSubmit}>
      <section>
        <h2 className="text-base font-semibold">1) 나이</h2>
        <input
          type="number"
          value={age}
          onChange={(event) => setAge(event.target.value)}
          min={19}
          max={100}
          className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
        />
      </section>

      <section>
        <h2 className="text-base font-semibold">2) 투자 가능 금액 (원)</h2>
        <input
          type="number"
          value={seedMoney}
          onChange={(event) => setSeedMoney(event.target.value)}
          min={100000}
          step={100000}
          className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
        />
      </section>

      <section>
        <h2 className="text-base font-semibold">3) 위험 성향</h2>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {riskOptions.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-3"
            >
              <input
                type="radio"
                name="risk"
                checked={riskTolerance === option}
                onChange={() => setRiskTolerance(option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold">4) 투자 목표</h2>
        <textarea
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          className="mt-2 min-h-28 w-full rounded-lg border border-slate-300 px-4 py-3"
        />
      </section>

      <section>
        <h2 className="text-base font-semibold">5) 확인</h2>
        <p className="mt-2 text-sm text-slate-600">
          제출 시 FastAPI <code>POST /generate-portfolio</code>를 호출하여 결과 페이지를 생성합니다.
        </p>
      </section>

      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
      >
        {isSubmitting ? "결과 페이지로 이동 중..." : "추천 포트폴리오 확인하기"}
      </button>
    </form>
  );
}
