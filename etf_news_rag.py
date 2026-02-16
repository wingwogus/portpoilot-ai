import datetime
import hashlib
import json
import math
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple


TOKEN_RE = re.compile(r"[A-Za-z0-9']+")


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

    def __init__(self, data_path: str, cache_ttl_seconds: int = 300, embed_dim: int = 192):
        self.data_path = data_path
        self.cache_ttl_seconds = cache_ttl_seconds
        self.embed_dim = embed_dim
        self.docs: List[NewsDoc] = []
        self.query_cache: Dict[str, Dict[str, Any]] = {}

    def build_index(self) -> Dict[str, Any]:
        raw_items = self._load_sample_data()
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
            "built_at": self._now_iso(),
        }

    def search(self, tickers: List[str], limit: int = 8, prefer_recent_hours: int = 96) -> Dict[str, Any]:
        normalized_tickers = sorted({t.strip().upper() for t in tickers if t and t.strip()})
        if not normalized_tickers:
            return {
                "query_tickers": [],
                "count": 0,
                "cached": False,
                "items": [],
            }

        cache_key = f"{','.join(normalized_tickers)}|{limit}|{prefer_recent_hours}"
        cached = self.query_cache.get(cache_key)
        now_ts = self._now_timestamp()

        if cached and now_ts - cached["ts"] < self.cache_ttl_seconds:
            payload = dict(cached["payload"])
            payload["cached"] = True
            return payload

        query_text = f"ETF news {' '.join(normalized_tickers)}"
        query_embedding = self._embed_text(query_text)

        scored: List[Tuple[float, NewsDoc]] = []
        for doc in self.docs:
            ticker_overlap = len(set(normalized_tickers) & set(doc.tickers))
            ticker_score = min(1.0, ticker_overlap / max(1, len(normalized_tickers)))
            cosine = self._cosine_similarity(query_embedding, doc.embedding)
            recency = self._recency_score(doc.published_at, prefer_recent_hours)

            final_score = 0.55 * cosine + 0.30 * ticker_score + 0.15 * recency

            # Filter weakly related docs
            if ticker_overlap == 0 and final_score < 0.35:
                continue

            scored.append((final_score, doc))

        scored.sort(key=lambda x: x[0], reverse=True)

        items: List[Dict[str, Any]] = []
        for score, doc in scored[:limit]:
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
                }
            )

        payload = {
            "query_tickers": normalized_tickers,
            "count": len(items),
            "cached": False,
            "items": items,
        }

        self.query_cache[cache_key] = {
            "ts": now_ts,
            "payload": payload,
        }
        return payload

    def _load_sample_data(self) -> List[Dict[str, Any]]:
        if not os.path.exists(self.data_path):
            raise FileNotFoundError(f"sample news data not found: {self.data_path}")

        with open(self.data_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if not isinstance(data, list) or not data:
            raise ValueError("sample news data must be a non-empty JSON array")

        return data

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
