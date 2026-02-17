import datetime
import hashlib
import json
import math
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

TOKEN_RE = re.compile(r"[A-Za-z0-9가-힣']+")
DATE_RE = re.compile(r"(\d{4}-\d{2}-\d{2})")

FACTOR_KEYS = ["rates", "growth", "commodities", "policy", "sector"]

# ETF별 팩터 노출도(-1.0~+1.0). +는 팩터 개선 시 우호, -는 불리.
ETF_FACTOR_EXPOSURES: Dict[str, Dict[str, float]] = {
    "QQQ": {"rates": -0.9, "growth": 0.9, "commodities": -0.2, "policy": 0.4, "sector": 0.8},
    "SPY": {"rates": -0.3, "growth": 0.7, "commodities": 0.1, "policy": 0.2, "sector": 0.4},
    "SMH": {"rates": -0.8, "growth": 0.9, "commodities": -0.2, "policy": 0.3, "sector": 1.0},
    "XLE": {"rates": -0.1, "growth": 0.3, "commodities": 1.0, "policy": 0.4, "sector": 0.7},
    "TLT": {"rates": 1.0, "growth": -0.4, "commodities": -0.3, "policy": 0.2, "sector": 0.0},
    "IWM": {"rates": -0.5, "growth": 0.8, "commodities": 0.1, "policy": 0.3, "sector": 0.5},
    "EEM": {"rates": -0.3, "growth": 0.6, "commodities": 0.4, "policy": 0.2, "sector": 0.4},
}

CATEGORY_FACTOR_MAP: Dict[str, Dict[str, float]] = {
    "monetary_policy": {"rates": 1.0, "policy": 0.7},
    "inflation_wages": {"rates": 0.8, "growth": -0.2},
    "liquidity_plumbing": {"policy": 0.8, "rates": 0.3},
    "macro_data": {"growth": 0.9, "rates": 0.3},
    "activity_data": {"growth": 1.0, "commodities": 0.2},
    "energy_oil": {"commodities": 1.0, "growth": -0.2},
    "equity_theme_ai": {"sector": 1.0, "growth": 0.7, "rates": -0.2},
}


@dataclass
class EventDoc:
    doc_id: str
    date: str
    published_at: str
    source_type: str
    title: str
    event: str
    cause: str
    development: str
    market_reaction: str
    scenarios: List[str]
    invalidation: str
    category: str
    source: str
    url: str
    key_points: List[str]
    factor_scores: Dict[str, float]
    factor_direction: float
    embedding: List[float]


class ETFDecisionRAGService:
    def __init__(
        self,
        raw_dir: str,
        brief_dir: str,
        embed_dim: int = 256,
        prefer_recent_hours: int = 168,
    ):
        self.raw_dir = raw_dir
        self.brief_dir = brief_dir
        self.embed_dim = embed_dim
        self.prefer_recent_hours = prefer_recent_hours

        self.docs: List[EventDoc] = []
        self.archives_by_date: Dict[str, int] = {}
        self.latest_loaded: Dict[str, bool] = {"raw": False, "brief": False}
        self.built_at: Optional[str] = None

    def build_index(self) -> Dict[str, Any]:
        raw_rows = self._load_raw_rows()
        brief_rows = self._load_brief_rows()

        merged: Dict[str, Dict[str, Any]] = {}
        for row in raw_rows + brief_rows:
            key = row.get("doc_id") or self._stable_hash(f"{row.get('event','')}|{row.get('url','')}")
            prev = merged.get(key)
            if prev is None or self._row_rank(row) > self._row_rank(prev):
                merged[key] = row

        docs: List[EventDoc] = []
        archives: Dict[str, int] = {}
        for idx, row in enumerate(merged.values(), start=1):
            factor_scores = self._infer_factor_scores(row)
            factor_direction = self._infer_direction(row)
            text_for_embed = "\n".join([
                row.get("title", ""),
                row.get("event", ""),
                row.get("cause", ""),
                row.get("development", ""),
                row.get("market_reaction", ""),
                " ".join(row.get("scenarios", [])),
                row.get("invalidation", ""),
            ])
            date = row.get("date") or self._date_from_iso(row.get("published_at", "")) or "unknown"
            archives[date] = archives.get(date, 0) + 1
            docs.append(
                EventDoc(
                    doc_id=row.get("doc_id") or f"event_{idx:04d}",
                    date=date,
                    published_at=row.get("published_at") or self._now_iso(),
                    source_type=row.get("source_type", "unknown"),
                    title=row.get("title", ""),
                    event=row.get("event", ""),
                    cause=row.get("cause", ""),
                    development=row.get("development", ""),
                    market_reaction=row.get("market_reaction", ""),
                    scenarios=row.get("scenarios", []),
                    invalidation=row.get("invalidation", ""),
                    category=row.get("category", ""),
                    source=row.get("source", ""),
                    url=row.get("url", ""),
                    key_points=row.get("key_points", []),
                    factor_scores=factor_scores,
                    factor_direction=factor_direction,
                    embedding=self._embed_text(text_for_embed),
                )
            )

        self.docs = sorted(docs, key=lambda d: d.published_at, reverse=True)
        self.archives_by_date = dict(sorted(archives.items(), reverse=True))
        self.built_at = self._now_iso()

        return self.get_index_status()

    def decision_brief(self, tickers: List[str], limit_per_ticker: int = 5) -> Dict[str, Any]:
        normalized = [t.strip().upper() for t in tickers if t and t.strip()]
        if not normalized:
            raise ValueError("tickers 파라미터가 비어 있습니다. 예: QQQ,SPY,XLE,SMH")

        if not self.docs:
            self.build_index()

        items = []
        for ticker in normalized:
            items.append(self._decision_for_ticker(ticker, limit_per_ticker))

        return {
            "query_tickers": normalized,
            "generated_at": self._now_iso(),
            "index_built_at": self.built_at,
            "results": items,
        }

    def _decision_for_ticker(self, ticker: str, limit: int) -> Dict[str, Any]:
        exposure = ETF_FACTOR_EXPOSURES.get(ticker, {k: 0.2 for k in FACTOR_KEYS})
        q_embed = self._embed_text(f"{ticker} ETF 투자 판단 사건 인과 금리 성장 원자재 정책 섹터")

        scored: List[Tuple[float, float, float, EventDoc]] = []
        for d in self.docs:
            sim = self._cosine_similarity(q_embed, d.embedding)
            causal_bonus = self._causal_priority_score(d)
            rec = self._recency_score(d.published_at)
            factor_fit = self._factor_fit_score(d, exposure)
            score = 0.35 * sim + 0.30 * factor_fit + 0.20 * causal_bonus + 0.15 * rec
            if score < 0.18:
                continue
            scored.append((score, factor_fit, rec, d))

        scored.sort(key=lambda x: x[0], reverse=True)
        top = scored[: max(1, limit)]

        aggregate = 0.0
        evidences = []
        key_events = []
        risk_conditions = []
        for score, factor_fit, rec, d in top:
            directional = d.factor_direction * factor_fit
            weighted = directional * (0.55 + 0.45 * rec)
            aggregate += weighted
            key_events.append(
                {
                    "doc_id": d.doc_id,
                    "event": d.event or d.title,
                    "market_reaction": d.market_reaction,
                    "published_at": d.published_at,
                    "source": d.source,
                    "source_link": d.url,
                    "relevance_score": round(score, 4),
                }
            )
            evidences.append(
                {
                    "doc_id": d.doc_id,
                    "event": d.event or d.title,
                    "cause": d.cause,
                    "development": d.development,
                    "market_reaction": d.market_reaction,
                    "factor_scores": d.factor_scores,
                    "source": d.source,
                    "source_link": d.url,
                }
            )
            if d.invalidation:
                risk_conditions.append(d.invalidation)

        signal = "neutral"
        if aggregate >= 0.35:
            signal = "bullish"
        elif aggregate <= -0.35:
            signal = "bearish"

        confidence = min(0.95, max(0.25, 0.45 + 0.12 * len(top) + 0.2 * min(1.0, abs(aggregate))))

        causal_summary = self._build_causal_summary(top, ticker)

        return {
            "ticker": ticker,
            "signal": signal,
            "confidence": round(confidence, 3),
            "conclusion": self._build_conclusion(ticker, signal, aggregate),
            "causal_summary": causal_summary,
            "key_events": key_events,
            "evidence": evidences,
            "risk_invalidation_conditions": list(dict.fromkeys(risk_conditions))[:4],
            "factor_exposure_used": exposure,
        }

    def get_index_status(self) -> Dict[str, Any]:
        return {
            "indexed_docs": len(self.docs),
            "embed_dim": self.embed_dim,
            "raw_dir": self.raw_dir,
            "brief_dir": self.brief_dir,
            "archives_by_date": self.archives_by_date,
            "latest_loaded": self.latest_loaded,
            "built_at": self.built_at,
        }

    def _load_raw_rows(self) -> List[Dict[str, Any]]:
        files = self._collect_files(self.raw_dir)
        rows: List[Dict[str, Any]] = []
        latest_hit = False
        for path in files:
            name = os.path.basename(path)
            if not name.endswith(".json"):
                continue
            if "latest" in name:
                latest_hit = True
            payload = self._read_json(path)
            items = payload.get("items", []) if isinstance(payload, dict) else []
            for item in items:
                title = str(item.get("title", "")).strip()
                key_points = [str(x).strip() for x in item.get("key_points", []) if str(x).strip()]
                content = " ".join(key_points)
                rows.append(
                    {
                        "doc_id": str(item.get("id") or self._stable_hash(f"raw|{title}|{item.get('url','')}")),
                        "date": self._extract_date_from_filename(name),
                        "published_at": str(item.get("published_at", "")).strip() or self._now_iso(),
                        "source_type": "raw",
                        "title": title,
                        "event": title,
                        "cause": key_points[0] if key_points else "",
                        "development": key_points[1] if len(key_points) > 1 else content,
                        "market_reaction": key_points[2] if len(key_points) > 2 else "",
                        "scenarios": [],
                        "invalidation": "",
                        "category": str(item.get("category", "")).strip(),
                        "source": str(item.get("source", "")).strip(),
                        "url": str(item.get("url", "")).strip(),
                        "key_points": key_points,
                    }
                )
        self.latest_loaded["raw"] = latest_hit
        return rows

    def _load_brief_rows(self) -> List[Dict[str, Any]]:
        files = self._collect_files(self.brief_dir)
        rows: List[Dict[str, Any]] = []
        latest_hit = False
        for path in files:
            name = os.path.basename(path)
            if name.endswith(".json"):
                if "latest" in name:
                    latest_hit = True
                payload = self._read_json(path)
                events = payload.get("events", []) if isinstance(payload, dict) else []
                date = str(payload.get("date", "")).strip() or self._extract_date_from_filename(name)
                for idx, ev in enumerate(events, start=1):
                    event_name = str(ev.get("event", "")).strip()
                    rows.append(
                        {
                            "doc_id": f"brief_{date}_{idx}_{self._stable_hash(event_name)[:8]}",
                            "date": date,
                            "published_at": str(payload.get("generated_at_utc", "")).strip() or self._now_iso(),
                            "source_type": "brief_json",
                            "title": event_name,
                            "event": event_name,
                            "cause": str(ev.get("cause", "")).strip(),
                            "development": str(ev.get("development", "")).strip(),
                            "market_reaction": str(ev.get("market_reaction", "")).strip(),
                            "scenarios": [str(x).strip() for x in ev.get("scenarios", []) if str(x).strip()],
                            "invalidation": str(ev.get("invalidation", "")).strip(),
                            "category": self._infer_category_from_text(event_name),
                            "source": "RESEARCHER",
                            "url": "",
                            "key_points": [],
                        }
                    )
            elif name.endswith(".md"):
                # markdown 브리프도 동시에 인덱싱(날짜별 archive + latest와 병행)
                text = self._read_text(path)
                rows.extend(self._parse_brief_markdown(text, name))

        self.latest_loaded["brief"] = latest_hit
        return rows

    def _parse_brief_markdown(self, text: str, filename: str) -> List[Dict[str, Any]]:
        date = self._extract_date_from_filename(filename)
        chunks = [c.strip() for c in text.split("\n## ") if c.strip()]
        out: List[Dict[str, Any]] = []
        for idx, chunk in enumerate(chunks, start=1):
            lines = [ln.strip() for ln in chunk.splitlines() if ln.strip()]
            if not lines:
                continue
            header = lines[0].lstrip("#").strip()
            body = "\n".join(lines[1:])
            cause = self._extract_bullet_after(body, "원인")
            development = self._extract_bullet_after(body, "전개")
            market_reaction = self._extract_bullet_after(body, "시장반응")
            invalidation = self._extract_after_label(body, "무효화")
            out.append(
                {
                    "doc_id": f"brief_md_{date}_{idx}_{self._stable_hash(header)[:8]}",
                    "date": date,
                    "published_at": f"{date}T00:00:00Z" if date else self._now_iso(),
                    "source_type": "brief_md",
                    "title": header,
                    "event": header,
                    "cause": cause,
                    "development": development,
                    "market_reaction": market_reaction,
                    "scenarios": [],
                    "invalidation": invalidation,
                    "category": self._infer_category_from_text(header + " " + body),
                    "source": "RESEARCHER_MD",
                    "url": "",
                    "key_points": [],
                }
            )
        return out

    def _infer_factor_scores(self, row: Dict[str, Any]) -> Dict[str, float]:
        scores = {k: 0.0 for k in FACTOR_KEYS}
        cat = str(row.get("category", "")).strip().lower()
        for k, v in CATEGORY_FACTOR_MAP.get(cat, {}).items():
            scores[k] += v

        text = " ".join([
            row.get("event", ""),
            row.get("cause", ""),
            row.get("development", ""),
            row.get("market_reaction", ""),
            " ".join(row.get("scenarios", [])),
            row.get("invalidation", ""),
            " ".join(row.get("key_points", [])),
        ]).lower()

        lexicon = {
            "rates": ["금리", "fomc", "fed", "yield", "채권", "인하", "동결", "긴축"],
            "growth": ["성장", "pmi", "고용", "경기", "수요", "침체", "회복"],
            "commodities": ["원유", "유가", "원자재", "brent", "공급", "재고"],
            "policy": ["정책", "부양", "유동성", "repo", "백스톱", "규제"],
            "sector": ["ai", "반도체", "기술", "에너지", "섹터", "밸류체인"],
        }
        for factor, kws in lexicon.items():
            hit = sum(1 for kw in kws if kw in text)
            scores[factor] += min(1.0, hit * 0.2)

        max_abs = max(1.0, max(abs(v) for v in scores.values()))
        return {k: round(v / max_abs, 3) for k, v in scores.items()}

    def _infer_direction(self, row: Dict[str, Any]) -> float:
        text = " ".join([
            row.get("event", ""),
            row.get("cause", ""),
            row.get("development", ""),
            row.get("market_reaction", ""),
            " ".join(row.get("scenarios", [])),
        ]).lower()
        pos = ["완화", "개선", "상승", "회복", "우호", "반등", "정상화", "확대"]
        neg = ["둔화", "하락", "경색", "리스크", "충격", "급등", "변동성", "우려", "수축"]
        p = sum(text.count(k) for k in pos)
        n = sum(text.count(k) for k in neg)
        if p + n == 0:
            return 0.0
        return max(-1.0, min(1.0, (p - n) / max(2.0, p + n)))

    def _factor_fit_score(self, d: EventDoc, exposure: Dict[str, float]) -> float:
        fit = 0.0
        for k in FACTOR_KEYS:
            fit += abs(d.factor_scores.get(k, 0.0)) * abs(exposure.get(k, 0.0))
        return min(1.0, fit / 2.5)

    def _causal_priority_score(self, d: EventDoc) -> float:
        score = 0.0
        if d.event:
            score += 0.25
        if d.cause:
            score += 0.25
        if d.market_reaction:
            score += 0.25
        if d.invalidation:
            score += 0.25
        return score

    def _build_causal_summary(self, top: List[Tuple[float, float, float, EventDoc]], ticker: str) -> str:
        if not top:
            return f"{ticker} 관련 사건 데이터가 부족하여 인과 요약 신뢰도가 낮습니다."
        parts = []
        for _, _, _, d in top[:3]:
            event = d.event or d.title
            reaction = d.market_reaction or "시장 반응 정보 제한"
            parts.append(f"{event} → {reaction}")
        return " | ".join(parts)

    def _build_conclusion(self, ticker: str, signal: str, aggregate: float) -> str:
        if signal == "bullish":
            return f"{ticker}: 사건/인과 기반 점수는 긍정 우위(aggregate={aggregate:.2f})로, 단기~중기 비중 확대 검토가 가능합니다."
        if signal == "bearish":
            return f"{ticker}: 부정 인과가 우세(aggregate={aggregate:.2f})하여 방어적 접근 또는 비중 축소가 타당합니다."
        return f"{ticker}: 상·하방 인과가 혼재(aggregate={aggregate:.2f})하여 중립 유지와 추가 확인 이벤트 대기가 적절합니다."

    def _recency_score(self, published_at: str) -> float:
        try:
            dt = self._parse_iso_datetime(published_at)
        except Exception:
            return 0.2
        age_hours = max(0.0, (self._now_datetime() - dt).total_seconds() / 3600.0)
        if age_hours <= self.prefer_recent_hours:
            return 1.0
        if age_hours <= self.prefer_recent_hours * 2:
            return 0.7
        return max(0.1, math.exp(-(age_hours / 24.0) / 21.0))

    def _collect_files(self, base_dir: str) -> List[str]:
        if not os.path.isdir(base_dir):
            return []
        files = []
        for name in sorted(os.listdir(base_dir)):
            if name.startswith("."):
                continue
            path = os.path.join(base_dir, name)
            if os.path.isfile(path):
                files.append(path)
        return files

    def _extract_date_from_filename(self, filename: str) -> str:
        m = DATE_RE.search(filename)
        return m.group(1) if m else ""

    def _extract_bullet_after(self, body: str, label: str) -> str:
        m = re.search(rf"-\s*\*\*{re.escape(label)}\*\*:\s*(.+)", body)
        return m.group(1).strip() if m else ""

    def _extract_after_label(self, body: str, label: str) -> str:
        m = re.search(rf"{re.escape(label)}[^\n:]*:\s*(.+)", body)
        return m.group(1).strip() if m else ""

    def _infer_category_from_text(self, text: str) -> str:
        t = text.lower()
        if any(k in t for k in ["fomc", "연준", "금리", "ecb"]):
            return "monetary_policy"
        if any(k in t for k in ["pmi", "cpi", "고용", "성장"]):
            return "macro_data"
        if any(k in t for k in ["유가", "원유", "iea", "brent"]):
            return "energy_oil"
        if any(k in t for k in ["ai", "반도체", "기술"]):
            return "equity_theme_ai"
        return "macro_data"

    def _row_rank(self, row: Dict[str, Any]) -> int:
        # brief_json > brief_md > raw
        st = row.get("source_type", "")
        if st == "brief_json":
            return 3
        if st == "brief_md":
            return 2
        return 1

    def _embed_text(self, text: str) -> List[float]:
        vec = [0.0] * self.embed_dim
        tokens = TOKEN_RE.findall(text.lower())
        if not tokens:
            return vec
        for token in tokens:
            digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
            idx = int(digest[:8], 16) % self.embed_dim
            sign = 1.0 if int(digest[8:10], 16) % 2 == 0 else -1.0
            vec[idx] += sign
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]

    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        if len(a) != len(b) or not a:
            return 0.0
        return sum(x * y for x, y in zip(a, b))

    def _read_json(self, path: str) -> Dict[str, Any]:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _read_text(self, path: str) -> str:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()

    def _stable_hash(self, s: str) -> str:
        return hashlib.sha256(s.encode("utf-8")).hexdigest()

    def _parse_iso_datetime(self, value: str) -> datetime.datetime:
        value = str(value).strip().replace("Z", "")
        dt = datetime.datetime.fromisoformat(value)
        if dt.tzinfo is not None:
            dt = dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        return dt

    def _date_from_iso(self, value: str) -> str:
        try:
            return self._parse_iso_datetime(value).date().isoformat()
        except Exception:
            return ""

    def _now_datetime(self) -> datetime.datetime:
        return datetime.datetime.utcnow()

    def _now_iso(self) -> str:
        return self._now_datetime().replace(microsecond=0).isoformat() + "Z"
