import { type EtfNewsCard } from "@/lib/api/etf-news-client";

export type HomeFeedNewsLink = {
  title: string;
  url: string;
  source?: string;
  ticker?: string;
};

export type HomeFeedSectorCard = {
  sector: string;
  etfCount: number;
  hotNews: HomeFeedNewsLink[];
};

export type HomeFeedPayload = {
  generatedAt?: string;
  locale?: string;
  sectorCards: HomeFeedSectorCard[];
  etfCards: EtfNewsCard[];
};

type UnknownRecord = Record<string, unknown>;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function parseSignal(value: unknown): "bullish" | "neutral" | "bearish" {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "bullish") return "bullish";
  if (normalized === "bearish") return "bearish";
  return "neutral";
}

function asNews(input: unknown): HomeFeedNewsLink | null {
  if (!input || typeof input !== "object") return null;
  const row = input as UnknownRecord;
  const title = String(row.title ?? "").trim();
  const url = String(row.url ?? "").trim();
  if (!title || !url) return null;
  return {
    title,
    url,
    source: row.source ? String(row.source) : undefined,
    ticker: row.ticker ? String(row.ticker) : undefined,
  };
}

function normalize(payload: unknown): HomeFeedPayload {
  const obj = (payload ?? {}) as UnknownRecord;

  const sectorCards = Array.isArray(obj.sector_cards)
    ? obj.sector_cards
        .map((card) => {
          if (!card || typeof card !== "object") return null;
          const row = card as UnknownRecord;
          return {
            sector: String(row.sector ?? "기타"),
            etfCount: Number(row.etf_count ?? 0),
            hotNews: Array.isArray(row.hot_news)
              ? row.hot_news.map(asNews).filter((n): n is HomeFeedNewsLink => n !== null)
              : [],
          } as HomeFeedSectorCard;
        })
        .filter((x): x is HomeFeedSectorCard => x !== null)
    : [];

  const etfCards = Array.isArray(obj.etf_cards)
    ? obj.etf_cards
        .map((card) => {
          if (!card || typeof card !== "object") return null;
          const row = card as UnknownRecord;
          const ticker = String(row.ticker ?? "").toUpperCase().trim();
          if (!ticker) return null;
          return {
            ticker,
            name: "ETF",
            signal: parseSignal(row.signal),
            summary: String(row.summary ?? "요약 정보가 없습니다."),
            updatedAt: row.updated_at ? String(row.updated_at) : undefined,
            sectors: Array.isArray(row.sectors) ? row.sectors.map((s) => String(s)) : [],
            news: Array.isArray(row.news)
              ? row.news.map(asNews).filter((n): n is HomeFeedNewsLink => n !== null).map((n) => ({ title: n.title, url: n.url, source: n.source }))
              : [],
          } as EtfNewsCard;
        })
        .filter((x): x is EtfNewsCard => x !== null)
    : [];

  return {
    generatedAt: obj.generated_at ? String(obj.generated_at) : undefined,
    locale: obj.locale ? String(obj.locale) : undefined,
    sectorCards,
    etfCards,
  };
}

export async function fetchHomeFeed(): Promise<HomeFeedPayload> {
  const response = await fetch(`${API_BASE}/home-feed`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`홈 피드 조회 실패 (${response.status})`);
  }

  const data = (await response.json()) as unknown;
  return normalize(data);
}
