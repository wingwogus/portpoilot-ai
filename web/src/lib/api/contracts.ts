import type {
  BriefingResult,
  CheckupInput,
  ReasonResult,
  RecomposeInput,
  RecomposeResult,
} from "@/lib/types";

export interface ReasonApi {
  submitCheckup(input: CheckupInput): Promise<{ jobId: string }>;
  getResult(jobId: string): Promise<ReasonResult>;
  recompose(input: RecomposeInput): Promise<RecomposeResult>;
  getBriefing(jobId: string): Promise<BriefingResult>;
}
