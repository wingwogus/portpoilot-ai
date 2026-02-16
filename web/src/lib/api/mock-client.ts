import type { JobStatus, ReasonApi } from "@/lib/api/contracts";
import type { BriefingResult, CheckupInput, ReasonResult, RecomposeInput, RecomposeResult } from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type SnakeCaseJobResponse = {
  job_id: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  checkup_id: string;
  result?: {
    checkup_id?: string;
    overall_score?: number;
    verdict?: string;
  } | null;
};

type SnakeCaseCheckupResponse = {
  checkup_id: string;
  job_id?: string | null;
  status: string;
  overall_score: number;
  verdict: string;
  findings: Array<{
    area: string;
    score: number;
    summary: string;
    evidence: string[];
    recommendation: string;
  }>;
  next_actions: string[];
};

type SnakeCaseBriefingResponse = {
  checkup_id: string;
  audience: string;
  tone: string;
  headline: string;
  summary: string;
  bullets: string[];
};

type CreateCheckupResponse = {
  checkup_id: string;
  job_id: string;
  status: string;
};

type CamelJobResponse = {
  jobId: string;
  status: SnakeCaseJobResponse["status"];
  checkupId: string;
  result?: {
    checkupId?: string;
    overallScore?: number;
    verdict?: string;
  } | null;
};

type CamelCheckupResponse = {
  checkupId: string;
  jobId?: string | null;
  status: string;
  overallScore: number;
  verdict: string;
  findings: Array<{
    area: string;
    score: number;
    summary: string;
    evidence: string[];
    recommendation: string;
  }>;
  nextActions: string[];
};

type CamelBriefingResponse = {
  checkupId: string;
  audience: string;
  tone: string;
  headline: string;
  summary: string;
  bullets: string[];
};

const CHECKUP_MAP_KEY = "checkup:job-map";

const camelize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(camelize);
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [key, val]) => {
      const camelKey = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      acc[camelKey] = camelize(val);
      return acc;
    }, {});
  }

  return value;
};

const normalizeJobStatus = (status: SnakeCaseJobResponse["status"]): JobStatus => {
  if (status === "COMPLETED") return "completed";
  if (status === "FAILED") return "failed";
  return "processing";
};

const rememberCheckupId = (jobId: string, checkupId: string) => {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem(CHECKUP_MAP_KEY);
  const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  map[jobId] = checkupId;
  window.localStorage.setItem(CHECKUP_MAP_KEY, JSON.stringify(map));
};

const readRememberedCheckupId = (jobId: string): string | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CHECKUP_MAP_KEY);
  if (!raw) return null;

  try {
    const map = JSON.parse(raw) as Record<string, string>;
    return map[jobId] ?? null;
  } catch {
    return null;
  }
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return (await response.json()) as T;
};

const adaptReasonResult = (checkup: CamelCheckupResponse): ReasonResult => {
  const strengths = checkup.findings.filter((item) => item.score >= 70).map((item) => `${item.area}: ${item.summary}`);
  const blindSpots = checkup.findings.filter((item) => item.score < 70).map((item) => `${item.area}: ${item.summary}`);

  return {
    score: checkup.overallScore,
    risk: checkup.overallScore >= 75 ? "low" : checkup.overallScore >= 60 ? "medium" : "high",
    summary: checkup.findings[0]?.summary ?? `${checkup.verdict} 상태입니다.`,
    strengths: strengths.length > 0 ? strengths : [checkup.verdict],
    blindSpots: blindSpots.length > 0 ? blindSpots : ["추가 보완 포인트가 없습니다."],
    recommendation: checkup.nextActions[0] ?? "다음 액션을 정의해 주세요.",
  };
};

const resolveCheckupId = async (jobId: string): Promise<string> => {
  const remembered = readRememberedCheckupId(jobId);
  if (remembered) return remembered;

  const jobRaw = await request<SnakeCaseJobResponse>(`/api/v1/jobs/${jobId}`);
  const job = camelize(jobRaw) as CamelJobResponse;
  rememberCheckupId(jobId, job.checkupId);
  return job.checkupId;
};

export const mockReasonApi: ReasonApi = {
  async submitCheckup(input: CheckupInput): Promise<{ jobId: string; checkupId?: string }> {
    const payload = {
      product_name: "Reason",
      service_url: "https://reason.local",
      target_user: "포트폴리오 사용자",
      goal: input.goal,
      notes: `${input.concern} (의사결정 기간: ${input.horizonWeeks}주)`,
    };

    const created = await request<CreateCheckupResponse>("/api/v1/checkups", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const data = camelize(created) as { jobId: string; checkupId: string };
    rememberCheckupId(data.jobId, data.checkupId);

    return data;
  },

  async getJobStatus(jobId: string): Promise<{ status: JobStatus; checkupId?: string }> {
    const jobRaw = await request<SnakeCaseJobResponse>(`/api/v1/jobs/${jobId}`);
    const job = camelize(jobRaw) as CamelJobResponse;
    rememberCheckupId(jobId, job.checkupId);

    return {
      status: normalizeJobStatus(job.status),
      checkupId: job.checkupId,
    };
  },

  async getResult(jobId: string): Promise<ReasonResult> {
    const checkupId = await resolveCheckupId(jobId);
    const checkupRaw = await request<SnakeCaseCheckupResponse>(`/api/v1/checkups/${checkupId}`);
    const checkup = camelize(checkupRaw) as CamelCheckupResponse;

    if (checkup.status !== "COMPLETED") {
      throw new Error("결과 생성에 실패했습니다.");
    }

    return adaptReasonResult(checkup);
  },

  async recompose(input: RecomposeInput): Promise<RecomposeResult> {
    const checkupId = input.checkupId ?? (input.jobId ? await resolveCheckupId(input.jobId) : null);
    if (!checkupId) throw new Error("checkupId가 필요합니다.");

    const checkupRaw = await request<SnakeCaseCheckupResponse>(`/api/v1/checkups/${checkupId}/recompose`, {
      method: "POST",
      body: JSON.stringify({ focus: input.focus }),
    });

    const checkup = camelize(checkupRaw) as CamelCheckupResponse;

    const toneHint =
      input.tone === "optimistic"
        ? "상방 가능성을 중심으로 재구성"
        : input.tone === "conservative"
          ? "하방 방어를 우선으로 재구성"
          : "균형 관점으로 재구성";

    return {
      reframedSummary: `${toneHint}. ${checkup.verdict}`,
      nextSteps: checkup.nextActions.slice(0, 3),
    };
  },

  async getBriefing(jobId: string): Promise<BriefingResult> {
    const checkupId = await resolveCheckupId(jobId);
    const briefingRaw = await request<SnakeCaseBriefingResponse>(`/api/v1/checkups/${checkupId}/briefings`, {
      method: "POST",
      body: JSON.stringify({ audience: "team", tone: "actionable" }),
    });

    const briefing = camelize(briefingRaw) as CamelBriefingResponse;

    return {
      headline: briefing.headline,
      talkingPoints: [briefing.summary, ...briefing.bullets],
      caveat: `대상: ${briefing.audience}, 톤: ${briefing.tone}`,
    };
  },
};
