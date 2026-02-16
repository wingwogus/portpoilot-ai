export type RiskTolerance = "안정형" | "중립형" | "공격형";

export type SurveyForm = {
  age: number;
  seedMoney: number;
  riskTolerance: RiskTolerance;
  goal: string;
};

export type PortfolioItem = {
  ticker: string;
  summary: string;
  ratio: number;
  reason: string;
};

export type PortfolioResponse = {
  marketAnalysis: string;
  summaryComment: string;
  items: PortfolioItem[];
};

// legacy checkup flow types (보조 라우트 호환)
export type CheckupInput = {
  goal: string;
  concern: string;
  horizonWeeks: number;
};

export type ReasonResult = {
  score: number;
  risk: "low" | "medium" | "high";
  summary: string;
  strengths: string[];
  blindSpots: string[];
  recommendation: string;
};

export type RecomposeInput = {
  jobId?: string;
  checkupId?: string;
  tone: "balanced" | "optimistic" | "conservative";
  focus: string;
};

export type RecomposeResult = {
  reframedSummary: string;
  nextSteps: string[];
};

export type BriefingResult = {
  headline: string;
  talkingPoints: string[];
  caveat: string;
};
