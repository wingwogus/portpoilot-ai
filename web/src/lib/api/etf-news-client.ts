export type SignalTone = "bullish" | "neutral" | "bearish";

export type NewsLink = {
  title: string;
  url: string;
  source?: string;
};

export type EtfNewsCard = {
  ticker: string;
  name?: string;
  signal: SignalTone;
  summary: string;
  updatedAt?: string;
  news: NewsLink[];
};

type UnknownRecord = Record<string, unknown>;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function parseSignal(value: unknown): SignalTone {
  const normalized = String(value ?? "").toLowerCase();
  if (["bullish", "buy", "positive", "상승"].includes(normalized)) return "bullish";
  if (["bearish", "sell", "negative", "하락"].includes(normalized)) return "bearish";
  return "neutral";
}

function asNewsLink(input: unknown): NewsLink | null {
  if (!input || typeof input !== "object") return null;
  const row = input as UnknownRecord;
  const title = String(row.title ?? row.headline ?? "").trim();
  const url = String(row.url ?? row.link ?? "").trim();
  if (!title || !url) return null;
  return {
    title,
    url,
    source: row.source ? String(row.source) : undefined,
  };
}

function asCard(input: unknown): EtfNewsCard | null {
  if (!input || typeof input !== "object") return null;
  const row = input as UnknownRecord;

  const ticker = String(row.ticker ?? row.symbol ?? "").toUpperCase().trim();
  if (!ticker) return null;

  const newsSource = (row.news ?? row.related_news ?? row.links ?? []) as unknown[];
  const news = Array.isArray(newsSource)
    ? newsSource.map(asNewsLink).filter((item): item is NewsLink => item !== null).slice(0, 3)
    : [];

  return {
    ticker,
    name: row.name ? String(row.name) : undefined,
    signal: parseSignal(row.signal ?? row.badge ?? row.sentiment),
    summary: String(row.summary ?? row.commentary ?? "요약 정보가 없습니다."),
    updatedAt: row.updated_at ? String(row.updated_at) : row.updatedAt ? String(row.updatedAt) : undefined,
    news,
  };
}

function normalize(payload: unknown): EtfNewsCard[] {
  if (Array.isArray(payload)) {
    return payload.map(asCard).filter((item): item is EtfNewsCard => item !== null);
  }

  if (payload && typeof payload === "object") {
    const obj = payload as UnknownRecord;
    const list = obj.items ?? obj.data ?? obj.etfs ?? [];
    if (Array.isArray(list)) {
      return list.map(asCard).filter((item): item is EtfNewsCard => item !== null);
    }
  }

  return [];
}

export async function fetchEtfNews(): Promise<EtfNewsCard[]> {
  const response = await fetch(`${API_BASE}/etf-news`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ETF 뉴스 조회 실패 (${response.status}): ${text}`);
  }

  const data = (await response.json()) as unknown;
  return normalize(data);
}
