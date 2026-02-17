export type DecisionSignal = "bullish" | "neutral" | "bearish";

export type DecisionEvent = {
  event: string;
  marketReaction: string;
  publishedAt: string;
  source: string;
  sourceLink: string;
};

export type DecisionCard = {
  ticker: string;
  signal: DecisionSignal;
  confidence: number;
  conclusion: string;
  causalSummary: string;
  keyEvents: DecisionEvent[];
  riskInvalidationConditions: string[];
};

type UnknownRecord = Record<string, unknown>;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function asSignal(value: unknown): DecisionSignal {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "bullish") return "bullish";
  if (normalized === "bearish") return "bearish";
  return "neutral";
}

function toNumber(input: unknown): number {
  const value = Number(input);
  if (Number.isFinite(value)) return value;
  return 0;
}

function asEvent(input: unknown): DecisionEvent | null {
  if (!input || typeof input !== "object") return null;
  const row = input as UnknownRecord;

  const event = String(row.event ?? "").trim();
  const sourceLink = String(row.source_link ?? "").trim();
  if (!event || !sourceLink) return null;

  return {
    event,
    marketReaction: String(row.market_reaction ?? "시장 반응 정보 없음"),
    publishedAt: String(row.published_at ?? ""),
    source: String(row.source ?? "출처 미상"),
    sourceLink,
  };
}

function asCard(input: unknown): DecisionCard | null {
  if (!input || typeof input !== "object") return null;
  const row = input as UnknownRecord;

  const ticker = String(row.ticker ?? "").toUpperCase().trim();
  if (!ticker) return null;

  const eventsRaw = Array.isArray(row.key_events) ? row.key_events : [];

  return {
    ticker,
    signal: asSignal(row.signal),
    confidence: toNumber(row.confidence),
    conclusion: String(row.conclusion ?? "결론 정보가 없습니다."),
    causalSummary: String(row.causal_summary ?? "인과 요약 정보가 없습니다."),
    keyEvents: eventsRaw.map(asEvent).filter((item): item is DecisionEvent => item !== null).slice(0, 2),
    riskInvalidationConditions: Array.isArray(row.risk_invalidation_conditions)
      ? row.risk_invalidation_conditions.map((x) => String(x)).filter(Boolean).slice(0, 3)
      : [],
  };
}

function normalize(payload: unknown): DecisionCard[] {
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as UnknownRecord;
  const rows = Array.isArray(obj.results) ? obj.results : [];
  return rows.map(asCard).filter((item): item is DecisionCard => item !== null);
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as UnknownRecord;
    const detail = data.error ?? data.message ?? data.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  } catch {
    // fallback to text
  }

  const text = await response.text();
  return text || "응답 본문 없음";
}

export async function fetchEtfDecisionBrief(tickers: string[]): Promise<DecisionCard[]> {
  if (tickers.length === 0) return [];

  const params = new URLSearchParams({
    tickers: tickers.join(","),
    limit_per_ticker: "4",
  });

  const response = await fetch(`${API_BASE}/etf-decision-brief?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(`ETF 의사결정 브리프 조회 실패 (${response.status}): ${message}`);
  }

  const data = (await response.json()) as unknown;
  return normalize(data);
}
