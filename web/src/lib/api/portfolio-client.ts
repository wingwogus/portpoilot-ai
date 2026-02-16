import type { PortfolioResponse, SurveyForm } from "@/lib/types";

type RawPortfolioItem = {
  ticker: string;
  summary: string;
  ratio: number;
  reason: string;
};

type RawPortfolioResponse = {
  market_analysis: string;
  summary_comment: string;
  items: RawPortfolioItem[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function generatePortfolio(input: SurveyForm): Promise<PortfolioResponse> {
  const response = await fetch(`${API_BASE}/generate-portfolio`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      age: input.age,
      seed_money: input.seedMoney,
      risk_tolerance: input.riskTolerance,
      goal: input.goal,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`포트폴리오 생성 실패 (${response.status}): ${text}`);
  }

  const data = (await response.json()) as RawPortfolioResponse;

  return {
    marketAnalysis: data.market_analysis,
    summaryComment: data.summary_comment,
    items: data.items,
  };
}

export function normalizeRatios(items: PortfolioResponse["items"]): PortfolioResponse["items"] {
  const total = items.reduce((sum, item) => sum + item.ratio, 0);
  if (total === 100 || items.length === 0) {
    return items;
  }

  const scaled = items.map((item) => ({
    ...item,
    ratio: Math.round((item.ratio / total) * 100),
  }));

  const diff = 100 - scaled.reduce((sum, item) => sum + item.ratio, 0);
  scaled[0].ratio += diff;
  return scaled;
}
