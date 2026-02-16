export type RiskLevel = "low" | "medium" | "high";

export interface CheckupInput {
  goal: string;
  concern: string;
  horizonWeeks: number;
}

export interface ReasonResult {
  score: number;
  risk: RiskLevel;
  summary: string;
  strengths: string[];
  blindSpots: string[];
  recommendation: string;
}

export interface RecomposeInput {
  tone: "balanced" | "optimistic" | "conservative";
  focus: string;
  jobId?: string;
  checkupId?: string;
}

export interface RecomposeResult {
  reframedSummary: string;
  nextSteps: string[];
}

export interface BriefingResult {
  headline: string;
  talkingPoints: string[];
  caveat: string;
}
