import type { JobStatus, ReasonApi } from "@/lib/api/contracts";
import type {
  BriefingResult,
  CheckupInput,
  ReasonResult,
  RecomposeInput,
  RecomposeResult,
} from "@/lib/types";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const JOB_META_KEY = "checkup:meta:";

type JobMeta = {
  readyAt: number;
  status: JobStatus;
};

const makeResult = (input: CheckupInput): ReasonResult => ({
  score: Math.min(95, 60 + (input.goal.length % 30)),
  risk: input.concern.length > 80 ? "high" : input.concern.length > 35 ? "medium" : "low",
  summary: `목표 "${input.goal}" 기준으로 ${input.horizonWeeks}주 내 개선 여지가 있으며, 초기 마찰 구간 관리가 핵심입니다.`,
  strengths: ["목표가 명확함", "기간이 구체적임", "실행 윈도우가 정의됨"],
  blindSpots: ["주간 실행 일관성 가정이 큼", "대체 시나리오가 부족함", "외부 변수 리스크 정량화 미흡"],
  recommendation: "2주 단위 마이크로 파일럿을 운영하고, 선행지표 1개를 매일 추적한 뒤 확장/수정 결정을 하세요.",
});

const makeBriefing = (result: ReasonResult): BriefingResult => ({
  headline: `Reason 시그널: 리스크 ${result.risk.toUpperCase()} · 신뢰점수 ${result.score}/100`,
  talkingPoints: [
    result.summary,
    `핵심 강점: ${result.strengths[0]}`,
    `주의 포인트: ${result.blindSpots[0]}`,
    result.recommendation,
  ],
  caveat: "현재는 MVP 더미 결과입니다. 이후 실제 모델 응답으로 교체됩니다.",
});

const saveJobMeta = (jobId: string, payload: CheckupInput) => {
  if (typeof window === "undefined") return;

  const now = Date.now();
  // 입력 길이에 따라 0.5~1.4초 사이로 준비 시간 부여 (고정 대기 제거)
  const variableDelay = 500 + ((payload.goal.length + payload.concern.length) % 900);
  const delay = payload.concern.includes("지연") ? 12000 : variableDelay;
  const readyAt = now + delay;
  const status: JobStatus = payload.concern.includes("실패") ? "failed" : "processing";

  window.localStorage.setItem(`checkup:${jobId}`, JSON.stringify(payload));
  window.localStorage.setItem(`${JOB_META_KEY}${jobId}`, JSON.stringify({ readyAt, status } satisfies JobMeta));
};

const getJobMeta = (jobId: string): JobMeta | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(`${JOB_META_KEY}${jobId}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as JobMeta;
  } catch {
    return null;
  }
};

export const mockReasonApi: ReasonApi = {
  async submitCheckup(input: CheckupInput): Promise<{ jobId: string }> {
    await wait(250);
    const jobId = crypto.randomUUID();
    saveJobMeta(jobId, input);
    return { jobId };
  },

  async getJobStatus(jobId: string): Promise<{ status: JobStatus }> {
    await wait(120);

    const meta = getJobMeta(jobId);
    if (!meta) {
      return { status: "failed" };
    }

    if (meta.status === "failed") {
      return { status: "failed" };
    }

    return { status: Date.now() >= meta.readyAt ? "completed" : "processing" };
  },

  async getResult(jobId: string): Promise<ReasonResult> {
    await wait(180);

    if (typeof window === "undefined") {
      return makeResult({ goal: "MVP 출시", concern: "불확실한 리스크", horizonWeeks: 4 });
    }

    const status = await this.getJobStatus(jobId);
    if (status.status === "failed") {
      throw new Error("결과 생성에 실패했습니다.");
    }

    const raw = window.localStorage.getItem(`checkup:${jobId}`);
    const payload: CheckupInput = raw
      ? JSON.parse(raw)
      : { goal: "MVP 출시", concern: "불확실한 리스크", horizonWeeks: 4 };

    return makeResult(payload);
  },

  async recompose(input: RecomposeInput): Promise<RecomposeResult> {
    await wait(600);

    const toneHint =
      input.tone === "optimistic"
        ? "상방 가능성을 중심으로 실험 확장 관점에서 재구성"
        : input.tone === "conservative"
          ? "하방 방어를 우선하는 단계적 전개 관점에서 재구성"
          : "상방/하방 균형 관점에서 재구성";

    return {
      reframedSummary: `${toneHint}. 포커스: ${input.focus}`,
      nextSteps: [
        "의사결정 책임자와 마감 시점을 명확화",
        "48시간 내 무조건 실행 가능한 무회귀 액션 1개 확정",
        "중단 기준(킬 스위치) 지표 1개 지정",
      ],
    };
  },

  async getBriefing(jobId: string): Promise<BriefingResult> {
    const result = await this.getResult(jobId);
    return makeBriefing(result);
  },
};
