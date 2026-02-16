#!/usr/bin/env python3
"""
Normalize external ETF news JSON into PortPilot RAG input schema.

Input JSON: array[object]
Required fields per item:
- title (str)
- content (str)
- url (str)
Optional:
- id, published_at, tickers(list[str]), sectors(list[str])

Usage:
  python3 scripts/ingest-news-json.py --input raw/news.json --output data/ingested_etf_news.json
"""

import argparse
import datetime
import json
from pathlib import Path
from typing import Any, Dict, List


def _now_iso() -> str:
    return datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def _to_list_of_str(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    text = str(value).strip()
    if not text:
        return []
    return [x.strip() for x in text.split(",") if x.strip()]


def normalize_row(row: Dict[str, Any], idx: int) -> Dict[str, Any]:
    title = str(row.get("title", "")).strip()
    content = str(row.get("content", "")).strip()
    url = str(row.get("url", "")).strip()

    if not title or not content or not url:
        raise ValueError(f"row#{idx}: title/content/url are required")

    published_at = str(row.get("published_at", "")).strip() or _now_iso()
    tickers = sorted({t.upper() for t in _to_list_of_str(row.get("tickers"))})
    sectors = sorted(set(_to_list_of_str(row.get("sectors"))))

    return {
        "id": row.get("id") or f"ext_{idx:05d}",
        "title": title,
        "content": content,
        "url": url,
        "published_at": published_at,
        "tickers": tickers,
        "sectors": sectors,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    in_path = Path(args.input)
    out_path = Path(args.output)

    raw = json.loads(in_path.read_text(encoding="utf-8"))
    if not isinstance(raw, list) or not raw:
        raise ValueError("input must be a non-empty JSON array")

    normalized = [normalize_row(row, i) for i, row in enumerate(raw, start=1)]

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"normalized={len(normalized)} -> {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
