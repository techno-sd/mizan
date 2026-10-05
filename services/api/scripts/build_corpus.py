"""Download the approved sources and build a versioned corpus.

    python -m scripts.build_corpus --version 2026-10-05            # full corpus -> data/corpus/<version>/
    python -m scripts.build_corpus --version 2026-10-05 --fixture  # small offline set -> app/data/fixture_passages.json

Only sources from the challenge's scientific reference package («المرجعية والحزمة العلمية والبيانات») are used:
  * Quran: QuranEnc (موسوعة القرآن الكريم, Society for Islamic Content Service in Languages). Arabic text of the
    King Fahd Complex mushaf, with the approved English translation (english_saheeh).
  * Hadith: HadeethEnc (موسوعة الأحاديث النبوية, same society). Every hadith carries its source (التخريج) and an
    approved ruling (الحكم), as the package requires: «لا ينسب حديث دون مصدر وحكم معتمد في البيانات».

Source texts are stored verbatim. Normalized fields are derived for search only and never displayed.
The manifest records each download's URL and SHA-256.
"""

import argparse
import hashlib
import json
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path

from app.normalize import normalize
from app.references import attribution_collections

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "sources"

QURANENC_SURA = "https://quranenc.com/api/v1/translation/sura/english_saheeh/{s}"
HADEETHENC_LIST = "https://hadeethenc.com/api/v1/hadeeths/list/?language=ar&category_id={c}&page={p}&per_page=500"
HADEETHENC_ONE = "https://hadeethenc.com/api/v1/hadeeths/one/?language={lang}&id={id}"

SOURCES = {
    "quranenc": {
        "title": "QuranEnc (موسوعة القرآن الكريم): King Fahd Complex mushaf text + english_saheeh translation",
        "kind": "quran",
        "url": "https://quranenc.com",
        "license": "Listed in the challenge reference package (Society for Islamic Content Service in Languages). "
        "Free content with a public developer API.",
    },
    "hadeethenc": {
        "title": "HadeethEnc (موسوعة الأحاديث النبوية): hadith with takhrij, ruling, explanation, translations",
        "kind": "hadith",
        "url": "https://hadeethenc.com",
        "license": "Listed in the challenge reference package (Society for Islamic Content Service in Languages). "
        "Free content with a public developer API.",
    },
}

# Offline demo/test fixture: enough real text to exercise every status without a database.
FIXTURE_QURAN = [(1, a) for a in range(1, 8)] + [(2, a) for a in range(254, 258)] + [
    (49, 12), (49, 13), (49, 14), (112, 1), (112, 2), (112, 3), (112, 4), (16, 124), (16, 125), (16, 126), (5, 32),
]
FIXTURE_HADITH_PHRASES = [
    "إنما الأعمال بالنيات",
    "الطهور شطر الإيمان",
    "الدين النصيحة",
    "حتى يحب لأخيه",
    "من حسن إسلام المرء",
    "ليس الشديد بالصرعة",
    "إن الله لا ينظر إلى صوركم",
    "اتق الله حيثما كنت",
    "المسلم من سلم المسلمون",
]


def _get_json(url: str) -> object:
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "mizan-corpus-builder"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read())
        except Exception:
            if attempt == 3:
                raise
    raise RuntimeError(url)


def cached(name: str, download) -> tuple[dict, str]:
    """Load an aggregated source file from the cache, downloading it first if needed."""
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / name
    if not path.exists():
        path.write_text(json.dumps(download(), ensure_ascii=False), encoding="utf-8")
    raw = path.read_bytes()
    return json.loads(raw), hashlib.sha256(raw).hexdigest()


def download_quran() -> dict:
    with ThreadPoolExecutor(4) as ex:
        suras = dict(zip(range(1, 115), ex.map(lambda s: _get_json(QURANENC_SURA.format(s=s))["result"], range(1, 115))))
    return {"suras": {str(k): v for k, v in suras.items()}}


def hadeethenc_ids() -> list[str]:
    ids: set[str] = set()
    for c in range(1, 8):
        page, last = 1, 1
        while page <= last:
            j = _get_json(HADEETHENC_LIST.format(c=c, p=page))
            last = int(j["meta"]["last_page"])
            ids.update(h["id"] for h in j["data"])
            page += 1
    return sorted(ids, key=int)


def download_hadith(lang: str):
    def run() -> dict:
        ids = hadeethenc_ids()
        with ThreadPoolExecutor(6) as ex:
            records = list(ex.map(lambda i: _get_json(HADEETHENC_ONE.format(lang=lang, id=i)), ids))
        return {"records": records}

    return run


_FOOTNOTE = re.compile(r"\[\d+\]")


def quran_passages(downloads: list[dict]) -> list[dict]:
    data, sha = cached("quranenc-english_saheeh.json", download_quran)
    downloads.append({"source_id": "quranenc", "url": QURANENC_SURA.format(s="{1..114}"), "sha256": sha})
    out = []
    for s in range(1, 115):
        for a in data["suras"][str(s)]:
            n = int(a["aya"])
            out.append(
                {
                    "key": f"quran:{s}:{n}",
                    "source_id": "quranenc",
                    "collection": "quran",
                    "kind": "quran",
                    "book": s,
                    "number": n,
                    "number_label": f"{s}:{n}",
                    "numbering_scheme": "رقم السورة:رقم الآية (مصحف المدينة)",
                    "text_ar": a["arabic_text"].strip(),
                    "text_en": _FOOTNOTE.sub("", a.get("translation") or "").strip() or None,
                    "gradings": [],
                    "url": f"https://quranenc.com/ar/browse/arabic_moyassar/{s}#{n}",
                    "extra": {"translation": "english_saheeh"},
                }
            )
    return out


def hadith_passages(downloads: list[dict]) -> list[dict]:
    ar, sha_ar = cached("hadeethenc-ar.json", download_hadith("ar"))
    en, sha_en = cached("hadeethenc-en.json", download_hadith("en"))
    downloads += [
        {"source_id": "hadeethenc", "url": HADEETHENC_ONE.format(lang="ar", id="{id}"), "sha256": sha_ar},
        {"source_id": "hadeethenc", "url": HADEETHENC_ONE.format(lang="en", id="{id}"), "sha256": sha_en},
    ]
    english = {r["id"]: r for r in en["records"] if not r.get("missing")}
    out = []
    for r in ar["records"]:
        if r.get("missing") or not (r.get("hadeeth") or "").strip():
            continue
        e = english.get(r["id"], {})
        attribution = (r.get("attribution") or "").strip()
        grade = (r.get("grade") or "").strip()
        out.append(
            {
                "key": f"hadeethenc:{r['id']}",
                "source_id": "hadeethenc",
                "collection": "hadeethenc",
                "kind": "hadith",
                "book": int(r["categories"][0]) if r.get("categories") else None,
                "number": int(r["id"]),
                "number_label": str(r["id"]),
                "numbering_scheme": "رقم الحديث في موسوعة الأحاديث النبوية",
                "text_ar": r["hadeeth"].strip(),
                "text_en": (e.get("hadeeth") or "").strip() or None,
                # The encyclopedia's ruling, reviewed by its scholarly team (the package's approved source).
                "gradings": [{"scholar": "موسوعة الأحاديث النبوية", "grade": grade}] if grade else [],
                "url": f"https://hadeethenc.com/ar/browse/hadith/{r['id']}",
                "extra": {
                    "attribution": attribution,
                    "sources": attribution_collections(attribution),
                    "takhrij": (r.get("reference") or "").strip(),
                    "title": (r.get("title") or "").strip(),
                },
            }
        )
    return out


def with_norm(p: dict) -> dict:
    p["text_ar_norm"] = normalize(p["text_ar"])
    p["text_en_norm"] = normalize(p["text_en"]) if p.get("text_en") else None
    return p


def build_fixture(passages: list[dict]) -> list[dict]:
    keep: list[dict] = []
    quran = {(p["book"], p["number"]): p for p in passages if p["kind"] == "quran"}
    keep += [quran[k] for k in FIXTURE_QURAN if k in quran]
    for phrase in FIXTURE_HADITH_PHRASES:
        needle = normalize(phrase)
        keep += [p for p in passages if p["kind"] == "hadith" and needle in p["text_ar_norm"]][:2]
    seen, unique = set(), []
    for p in keep:
        if p["key"] not in seen:
            seen.add(p["key"])
            unique.append(p)
    return unique


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", required=True, help="corpus version id, e.g. 2026-10-05")
    ap.add_argument("--fixture", action="store_true", help="write the small offline fixture instead")
    args = ap.parse_args()

    downloads: list[dict] = []
    passages = [with_norm(p) for p in quran_passages(downloads) + hadith_passages(downloads)]
    counts: dict[str, int] = {}
    for p in passages:
        counts[p["collection"]] = counts.get(p["collection"], 0) + 1

    manifest = {
        "corpus_version": args.version,
        "built_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "reference_package": "المرجعية والحزمة العلمية والبيانات - تحدي الذكاء الاصطناعي في خدمة المحتوى الإسلامي",
        "sources": SOURCES,
        "downloads": downloads,
        "counts": counts,
    }

    if args.fixture:
        fixture = build_fixture(passages)
        for i, p in enumerate(fixture, start=1):
            p["id"] = i
        fields = ("id", "collection", "kind", "book", "number", "numbering_scheme", "text_ar", "text_en",
                  "gradings", "url", "text_ar_norm", "text_en_norm", "extra")
        out = ROOT / "app" / "data" / "fixture_passages.json"
        out.write_text(
            json.dumps(
                {
                    "corpus_version": f"{args.version}-fixture",
                    "notices": ["Quran: QuranEnc (quranenc.com). Hadith: HadeethEnc (hadeethenc.com)."],
                    "passages": [{k: (p[k] or "") if k.endswith("_norm") else p[k] for k in fields} for p in fixture],
                },
                ensure_ascii=False,
                indent=1,
            ),
            encoding="utf-8",
        )
        print(f"fixture: {len(fixture)} passages -> {out}")
        return

    out_dir = ROOT / "data" / "corpus" / args.version
    out_dir.mkdir(parents=True, exist_ok=True)
    with (out_dir / "passages.jsonl").open("w", encoding="utf-8") as fh:
        for p in passages:
            fh.write(json.dumps(p, ensure_ascii=False) + "\n")
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"corpus {args.version}: {len(passages)} passages {counts} -> {out_dir}")


if __name__ == "__main__":
    main()
