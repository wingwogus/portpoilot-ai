import type {
  BriefingResult,
  CheckupInput,
  ReasonResult,
  RecomposeInput,
  RecomposeResult,
} from "@/lib/types";

export type JobStatus = "processing" | "completed" | "failed";

export interface ReasonApi {
  submitCheckup(input: CheckupInput): Promise<{ jobId: string }>;
  getJobStatus(jobId: string): Promise<{ status: JobStatus }>;
  getResult(jobId: string): Promise<ReasonResult>;
  recompose(input: RecomposeInput): Promise<RecomposeResult>;
  getBriefing(jobId: string): Promise<BriefingResult>;
}
