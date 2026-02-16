import datetime
import hashlib
import json
import math
import os
import re
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from email.utils import parsedate_to_datetime
from typing import Any, Dict, List, Optional, Protocol, Tuple


TOKEN_RE = re.compile(r"[A-Za-z0-9']+")

TICKER_QUERY_EXPANSION: Dict[str, List[str]] = {
    "QQQ": ["nasdaq", "big tech", "ai", "semiconductor"],
    "SCHD": ["dividend", "quality", "cash flow", "large cap value"],
    "VOO": ["s&p 500", "broad market", "us large cap"],
    "SPY": ["s&p 500", "broad market", "us large cap"],
    "TLT": ["long treasury", "interest rate", "duration"],
    "IWM": ["small cap", "russell 2000", "domestic growth"],
    "XLE": ["energy", "oil", "gas"],
    "XLK": ["technology", "software", "semiconductor"],
}


class NewsDataProvider(Protocol):
    """Provider interface for ETF news source loading."""

    name: str

    def load_items(self) -> List[Dict[str, Any]]:
        ...


class JsonFileNewsProvider:
    """Load ETF news items from a local JSON file (array of objects)."""

    def __init__(self, data_path: str):
        self.data_path = data_path
        self.name = "json_file"

    def load_items(self) -> List[Dict[str, Any]]:
        if not os.path.exists(self.data_path):
            raise FileNotFoundError(f"sample news data not found: {self.data_path}")

        with open(self.data_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if not isinstance(data, list) or not data:
            raise ValueError("sample news data must be a non-empty JSON array")

        return data


class RSSNewsProvider:
    """Load ETF news items from RSS feeds and normalize into RAG rows."""

    def __init__(self, feed_urls: List[str], timeout_seconds: int = 8):
        self.feed_urls = [u.strip() for u in feed_urls if u and u.strip()]
        self.timeout_seconds = timeout_seconds
        self.name = "rss"

    def load_items(self) -> List[Dict[str, Any]]:
        if not self.feed_urls:
            raise ValueError("rss provider requires at least one feed url")

        dedup: Dict[str, Dict[str, Any]] = {}
        for feed_url in self.feed_urls:
            for row in self._load_single_feed(feed_url):
                # Keep the latest version when the same link appears across feeds.
                key = str(row.get("url") or row.get("id") or "").strip()
                if not key:
                    continue
                prev = dedup.get(key)
                if prev is None or row.get("published_at", "") >= prev.get("published_at", ""):
                    dedup[key] = row

        rows = list(dedup.values())
        if not rows:
            raise ValueError("rss provider loaded zero items")

        return rows

    def _load_single_feed(self, feed_url: str) -> List[Dict[str, Any]]:
        req = urllib.request.Request(feed_url, headers={"User-Agent": "PortPilot-RSS/1.0"})
        with urllib.request.urlopen(req, timeout=self.timeout_seconds) as resp:
            xml_bytes = resp.read()

        root = ET.fromstring(xml_bytes)
        items = root.findall("./channel/item")
        rows: List[Dict[str, Any]] = []

        for idx, item in enumerate(items, start=1):
            title = self._text(item.find("title"))
            link = self._text(item.find("link"))
            description = self._text(item.find("description"))
            pub_date_raw = self._text(item.find("pubDate"))

            if not title or not link or not description:
                continue

            tickers = self._extract_tickers(f"{title} {description}")
            sectors = self._extract_sectors(f"{title} {description}")
            published_at = self._to_iso(pub_date_raw)

            rows.append(
                {
                    "id": f"rss_{self._stable_hash(link)}_{idx:03d}",
                    "title": title,
                    "content": self._strip_tags(description),
                    "url": link,
                    "published_at": published_at,
                    "tickers": tickers,
                    "sectors": sectors,
                }
            )

        return rows

    def _extract_tickers(self, text: str) -> List[str]:
        upper = text.upper()
        candidates = sorted({t for t in TICKER_QUERY_EXPANSION if t in upper})
        return candidates

    def _extract_sectors(self, text: str) -> List[str]:
        lowered = text.lower()
        tags = []
        if any(k in lowered for k in ["tech", "ai", "software", "semiconductor"]):
            tags.append("Information Technology")
        if any(k in lowered for k in ["energy", "oil", "gas"]):
            tags.append("Energy")
        if any(k in lowered for k in ["treasury", "bond", "yield", "rate"]):
            tags.append("Fixed Income")
        if any(k in lowered for k in ["small cap", "russell"]):
            tags.append("Small Cap")
        return sorted(set(tags))

    def _to_iso(self, raw: str) -> str:
        if not raw:
            return datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
        try:
            dt = parsedate_to_datetime(raw)
            if dt.tzinfo is not None:
                dt = dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
            return dt.replace(microsecond=0).isoformat() + "Z"
        except Exception:
            return datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

    def _stable_hash(self, value: str) -> str:
        return hashlib.sha256(value.encode("utf-8")).hexdigest()[:10]

    def _text(self, node: Optional[ET.Element]) -> str:
        if node is None:
            return ""
        return (node.text or "").strip()

    def _strip_tags(self, text: str) -> str:
        return re.sub(r"<[^>]+>", " ", text).strip()


@dataclass
class NewsDoc:
    doc_id: str
    title: str
    content: str
    summary: str
    source_link: str
    published_at: str
    tickers: List[str]
    sectors: List[str]
    signal: str
    evidence: List[str]
    embedding: List[float]


class ETFNewsRAGService:
    """Lightweight built-in VectorDB + ETF news retrieval service."""

    def __init__(
        self,
        data_path: str,
        cache_ttl_seconds: int = 300,
        embed_dim: int = 192,
        provider: Optional[NewsDataProvider] = None,
    ):
        self.data_path = data_path
        self.cache_ttl_seconds = cache_ttl_seconds
        self.embed_dim = embed_dim
        self.provider = provider or JsonFileNewsProvider(data_path=data_path)
        self.docs: List[NewsDoc] = []
        self.query_cache: Dict[str, Dict[str, Any]] = {}

    def build_index(self) -> Dict[str, Any]:
        raw_items = self.provider.load_items()
        docs: List[NewsDoc] = []

        for idx, row in enumerate(raw_items, start=1):
            normalized = self._normalize_news(row)
            full_text = f"{normalized['title']}\n{normalized['content']}"
            signal = self._infer_signal(full_text)
            summary = self._summarize(normalized['content'])
            evidence = self._extract_evidence(normalized['content'], normalized['tickers'], signal)
            embedding = self._embed_text(full_text)

            docs.append(
                NewsDoc(
                    doc_id=normalized.get("id") or f"news_{idx:04d}",
                    title=normalized["title"],
                    content=normalized["content"],
                    summary=summary,
                    source_link=normalized["url"],
                    published_at=normalized["published_at"],
                    tickers=normalized["tickers"],
                    sectors=normalized["sectors"],
                    signal=signal,
                    evidence=evidence,
                    embedding=embedding,
                )
            )

        self.docs = docs
        self.query_cache.clear()

        return {
            "indexed_docs": len(self.docs),
            "data_path": self.data_path,
            "provider": self.provider.name,
            "built_at": self._now_iso(),
        }

    def search(self, tickers: List[str], limit: int = 8, prefer_recent_hours: int = 96) -> Dict[str, Any]:
        normalized_tickers = sorted({t.strip().upper() for t in tickers if t and t.strip()})
        if not normalized_tickers:
            return {
                "query_tickers": [],
                "query_expansion_terms": [],
                "count": 0,
                "cached": False,
                "items": [],
            }

        expanded_terms = self._expand_query_terms(normalized_tickers)

        cache_key = f"{','.join(normalized_tickers)}|{'/'.join(expanded_terms)}|{limit}|{prefer_recent_hours}"
        cached = self.query_cache.get(cache_key)
        now_ts = self._now_timestamp()

        if cached and now_ts - cached["ts"] < self.cache_ttl_seconds:
            payload = dict(cached["payload"])
            payload["cached"] = True
            return payload

        query_text = self._build_query_text(normalized_tickers, expanded_terms)
        query_embedding = self._embed_text(query_text)

        scored: List[Tuple[float, float, float, float, NewsDoc]] = []
        for doc in self.docs:
            ticker_overlap = len(set(normalized_tickers) & set(doc.tickers))
            ticker_score = min(1.0, ticker_overlap / max(1, len(normalized_tickers)))
            cosine = self._cosine_similarity(query_embedding, doc.embedding)
            recency = self._recency_score(doc.published_at, prefer_recent_hours)

            final_score = 0.55 * cosine + 0.30 * ticker_score + 0.15 * recency

            # Filter weakly related docs
            if ticker_overlap == 0 and final_score < 0.35:
                continue

            scored.append((final_score, cosine, ticker_score, recency, doc))

        scored.sort(key=lambda x: x[0], reverse=True)

        items: List[Dict[str, Any]] = []
        for score, cosine, ticker_score, recency, doc in scored[:limit]:
            items.append(
                {
                    "doc_id": doc.doc_id,
                    "title": doc.title,
                    "source_link": doc.source_link,
                    "published_at": doc.published_at,
                    "summary": doc.summary,
                    "signal": doc.signal,
                    "evidence": doc.evidence,
                    "ticker_hits": sorted(set(doc.tickers) & set(normalized_tickers)),
                    "sector_tags": doc.sectors,
                    "score": round(float(score), 4),
                    "score_explain": self._explain_score(cosine=cosine, ticker_score=ticker_score, recency=recency),
                }
            )

        payload = {
            "query_tickers": normalized_tickers,
            "query_expansion_terms": expanded_terms,
            "count": len(items),
            "cached": False,
            "items": items,
        }

        self.query_cache[cache_key] = {
            "ts": now_ts,
            "payload": payload,
        }
        return payload

    def get_index_status(self) -> Dict[str, Any]:
        return {
            "indexed_docs": len(self.docs),
            "cache_ttl_seconds": self.cache_ttl_seconds,
            "embed_dim": self.embed_dim,
            "cached_queries": len(self.query_cache),
            "provider": self.provider.name,
        }

    def _explain_score(self, cosine: float, ticker_score: float, recency: float) -> str:
        semantic_w = 0.55 * cosine
        ticker_w = 0.30 * ticker_score
        recency_w = 0.15 * recency
        return (
            f"semantic={semantic_w:.3f}(55%), "
            f"ticker={ticker_w:.3f}(30%), "
            f"recency={recency_w:.3f}(15%)"
        )

    def _normalize_news(self, row: Dict[str, Any]) -> Dict[str, Any]:
        title = str(row.get("title", "")).strip()
        content = str(row.get("content", "")).strip()
        url = str(row.get("url", "")).strip()

        published_at = str(row.get("published_at", "")).strip()
        try:
            dt = self._parse_iso_datetime(published_at)
            published_at = dt.replace(microsecond=0).isoformat() + "Z"
        except Exception:
            published_at = self._now_iso()

        tickers = sorted({str(t).upper().strip() for t in row.get("tickers", []) if str(t).strip()})
        sectors = sorted({str(s).strip() for s in row.get("sectors", []) if str(s).strip()})

        if not title or not content or not url:
            raise ValueError("each news row requires title/content/url")

        return {
            "id": row.get("id"),
            "title": title,
            "content": content,
            "url": url,
            "published_at": published_at,
            "tickers": tickers,
            "sectors": sectors,
        }

    def _expand_query_terms(self, tickers: List[str], max_terms: int = 12) -> List[str]:
        terms: List[str] = []
        seen = set()

        for ticker in tickers:
            for term in TICKER_QUERY_EXPANSION.get(ticker, []):
                key = term.lower().strip()
                if not key or key in seen:
                    continue
                seen.add(key)
                terms.append(term)
                if len(terms) >= max_terms:
                    return terms

        return terms

    def _build_query_text(self, tickers: List[str], expanded_terms: List[str]) -> str:
        base = f"ETF news {' '.join(tickers)}"
        if not expanded_terms:
            return base
        return f"{base} {' '.join(expanded_terms)}"

    def _embed_text(self, text: str) -> List[float]:
        vec = [0.0] * self.embed_dim
        tokens = TOKEN_RE.findall(text.lower())

        if not tokens:
            return vec

        for token in tokens:
            digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
            bucket = int(digest[:8], 16) % self.embed_dim
            sign = 1.0 if (int(digest[8:10], 16) % 2 == 0) else -1.0
            vec[bucket] += sign

        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]

    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        if not a or not b or len(a) != len(b):
            return 0.0
        return sum(x * y for x, y in zip(a, b))

    def _summarize(self, text: str, max_chars: int = 180) -> str:
        compact = re.sub(r"\s+", " ", text).strip()
        if len(compact) <= max_chars:
            return compact
        return compact[: max_chars - 1] + "…"

    def _extract_evidence(self, text: str, tickers: List[str], signal: str) -> List[str]:
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
        if not sentences:
            return []

        signal_keywords = {
            "bullish": ["surge", "beat", "growth", "upgrade", "rally", "strong"],
            "bearish": ["drop", "fall", "cut", "risk", "miss", "weak"],
            "neutral": ["mixed", "stable", "flat", "unchanged"],
        }
        kws = signal_keywords.get(signal, [])

        scored: List[Tuple[int, str]] = []
        for sent in sentences:
            lowered = sent.lower()
            score = 0
            if any(t.lower() in lowered for t in tickers):
                score += 2
            score += sum(1 for kw in kws if kw in lowered)
            scored.append((score, sent))

        scored.sort(key=lambda x: x[0], reverse=True)
        picked = [s for score, s in scored if score > 0][:2]
        return picked or sentences[:2]

    def _infer_signal(self, text: str) -> str:
        lowered = text.lower()
        bull = ["surge", "beat", "upgrade", "rally", "strong", "expand", "record", "growth"]
        bear = ["drop", "fall", "downgrade", "risk", "miss", "weak", "slump", "cut"]

        b_score = sum(lowered.count(k) for k in bull)
        s_score = sum(lowered.count(k) for k in bear)

        if b_score - s_score >= 2:
            return "bullish"
        if s_score - b_score >= 2:
            return "bearish"
        return "neutral"

    def _recency_score(self, published_at: str, prefer_recent_hours: int) -> float:
        try:
            dt = self._parse_iso_datetime(published_at)
        except Exception:
            return 0.2

        age_hours = max(0.0, (self._now_datetime() - dt).total_seconds() / 3600.0)

        # Explicit recency bias: fresh news is strongly preferred.
        if age_hours <= prefer_recent_hours:
            return 1.0
        if age_hours <= prefer_recent_hours * 2:
            return 0.7

        # gentle decay for older docs
        days = age_hours / 24.0
        return max(0.1, math.exp(-days / 14.0))

    def _parse_iso_datetime(self, value: str) -> datetime.datetime:
        value = value.strip().replace("Z", "")
        dt = datetime.datetime.fromisoformat(value)
        if dt.tzinfo is not None:
            dt = dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        return dt

    def _now_datetime(self) -> datetime.datetime:
        return datetime.datetime.utcnow()

    def _now_iso(self) -> str:
        return self._now_datetime().replace(microsecond=0).isoformat() + "Z"

    def _now_timestamp(self) -> int:
        return int(self._now_datetime().timestamp())
