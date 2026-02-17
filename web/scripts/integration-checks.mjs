#!/usr/bin/env node

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function getJson(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  assert(response.ok, `${path} failed with status ${response.status}`);
  return response.json();
}

function runNewsAssertions(data) {
  assert(Array.isArray(data?.items), "/etf-news response must include items[]");
  if (data.items.length === 0) return;

  const first = data.items[0];
  assert(typeof first.summary === "string", "news item.summary must be string");
  assert(typeof first.signal === "string", "news item.signal must be string");
  assert(typeof first.source_link === "string", "news item.source_link must be string");
}

function runDecisionAssertions(data) {
  assert(Array.isArray(data?.results), "/etf-decision-brief response must include results[]");
  if (data.results.length === 0) return;

  const first = data.results[0];
  assert(typeof first.ticker === "string", "decision result.ticker must be string");
  assert(typeof first.signal === "string", "decision result.signal must be string");
  assert(typeof first.conclusion === "string", "decision result.conclusion must be string");
  assert(Array.isArray(first.key_events), "decision result.key_events must be array");
}

async function main() {
  console.log(`[integration] API base: ${API_BASE}`);

  const news = await getJson("/etf-news?tickers=QQQ,SPY&limit=4");
  runNewsAssertions(news);
  console.log(`[integration] /etf-news ok (items=${news.items?.length ?? 0})`);

  const decision = await getJson("/etf-decision-brief?tickers=QQQ,SPY&limit_per_ticker=2");
  runDecisionAssertions(decision);
  console.log(`[integration] /etf-decision-brief ok (results=${decision.results?.length ?? 0})`);

  console.log("[integration] all checks passed");
}

main().catch((error) => {
  console.error("[integration] failed:", error.message);
  process.exit(1);
});
