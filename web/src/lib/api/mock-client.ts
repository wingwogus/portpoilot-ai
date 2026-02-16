import type { ReasonApi } from "@/lib/api/contracts";
import type {
  BriefingResult,
  CheckupInput,
  ReasonResult,
  RecomposeInput,
  RecomposeResult,
} from "@/lib/types";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const makeResult = (input: CheckupInput): ReasonResult => ({
  score: Math.min(95, 60 + input.goal.length % 30),
  risk: input.concern.length > 80 ? "high" : input.concern.length > 35 ? "medium" : "low",
  summary: `For “${input.goal}”, momentum is possible within ${input.horizonWeeks} weeks if friction is reduced early.`,
  strengths: [
    "Clear objective defined",
    "Time horizon is explicit",
    "Action window identified",
  ],
  blindSpots: [
    "Assumes consistent weekly execution",
    "Missing explicit fallback path",
    "External dependency risk not quantified",
  ],
  recommendation:
    "Run a 2-week micro-pilot, track one leading metric daily, then decide to scale or pivot.",
});

const makeBriefing = (result: ReasonResult): BriefingResult => ({
  headline: `Reason signal: ${result.risk.toUpperCase()} risk, ${result.score}/100 confidence`,
  talkingPoints: [
    result.summary,
    `Top strength: ${result.strengths[0]}`,
    `Watchout: ${result.blindSpots[0]}`,
    result.recommendation,
  ],
  caveat: "Mocked output for MVP prototype — replace with live model contract.",
});

export const mockReasonApi: ReasonApi = {
  async submitCheckup(): Promise<{ jobId: string }> {
    await wait(700);
    return { jobId: crypto.randomUUID() };
  },

  async getResult(jobId: string): Promise<ReasonResult> {
    await wait(900);

    if (typeof window === "undefined") {
      return makeResult({ goal: "Launch MVP", concern: "Unknown risk", horizonWeeks: 4 });
    }

    const raw = window.localStorage.getItem(`checkup:${jobId}`);
    const payload: CheckupInput = raw
      ? JSON.parse(raw)
      : { goal: "Launch MVP", concern: "Unknown risk", horizonWeeks: 4 };

    return makeResult(payload);
  },

  async recompose(input: RecomposeInput): Promise<RecomposeResult> {
    await wait(600);

    const toneHint =
      input.tone === "optimistic"
        ? "Bias to upside with controlled experiments"
        : input.tone === "conservative"
          ? "Bias to downside protection and staged rollout"
          : "Balanced upside/downside framing";

    return {
      reframedSummary: `${toneHint}. Focus area: ${input.focus}.`,
      nextSteps: [
        "Clarify decision owner and decision deadline",
        "Define a no-regret action for the next 48 hours",
        "Add one objective kill-switch metric",
      ],
    };
  },

  async getBriefing(jobId: string): Promise<BriefingResult> {
    const result = await this.getResult(jobId);
    return makeBriefing(result);
  },
};
