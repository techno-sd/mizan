"""Download the sources and build a versioned corpus.

    python -m scripts.build_corpus --version 2026-10-04            # full corpus -> data/corpus/<version>/
    python -m scripts.build_corpus --version 2026-10-04 --fixture  # small offline set -> app/data/fixture_passages.json

Output is deterministic for a given set of downloads; the manifest records each download's SHA-256.
Source texts are stored verbatim. Normalized fields are derived for search only and never displayed.
"""

import argparse
import hashlib
import json
import urllib.request
import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from pathlib import Path

from app.normalize import normalize

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "sources"

TANZIL_URL = "https://tanzil.net/pub/download/index.php?quranType={t}&outType=xml&agree=true"
HADITH_URL = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/{e}.min.json"
HADITH_BOOKS = ["bukhari", "muslim", "abudawud", "tirmidhi", "nasai", "ibnmajah", "malik", "nawawi", "qudsi"]

TANZIL_NOTICE = (
    "Quran text: Tanzil Project (https://tanzil.net). Copied verbatim; changing the text is not allowed. "
    "Source must be indicated and a link to tanzil.net provided."
)

SOURCES = {
    "tanzil-simple": {
        "title": "Tanzil Quran Text (Simple)",
        "kind": "quran",
        "url": "https://tanzil.net",
        "license": "Tanzil terms: verbatim copies allowed with attribution and link; no modification.",
    },
    "hadith-api": {
        "title": "fawazahmed0/hadith-api (Arabic + English editions with gradings)",
        "kind": "hadith",
        "url": "https://github.com/fawazahmed0/hadith-api",
        "license": "Unlicense (public domain dedication). Gradings as provided by the dataset.",
    },
}

# Offline demo/test fixture: enough real text to exercise every status without a database.
FIXTURE_QURAN = [(1, a) for a in range(1, 8)] + [(2, a) for a in range(254, 258)] + [
    (49, 12), (49, 13), (49, 14), (112, 1), (112, 2), (112, 3), (112, 4), (16, 125), (5, 32),
]
FIXTURE_PHRASES = [
    ("bukhari", "إنما الأعمال بالنيات"),
    ("muslim", "الطهور شطر الإيمان"),
    ("muslim", "الدين النصيحة"),
    ("bukhari", "حتى يحب لأخيه"),
    ("muslim", "حتى يحب لأخيه"),
    ("ibnmajah", "طلب العلم فريضة"),
    ("tirmidhi", "من حسن إسلام المرء"),
    ("bukhari", "ليس الشديد بالصرعة"),
    ("muslim", "إن الله لا ينظر إلى صوركم"),
    ("abudawud", "إنما بعثت لأتمم"),
    ("tirmidhi", "اتق الله حيثما كنت"),
]


def fetch(url: str, name: str) -> tuple[bytes, str]:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / name
    if not path.exists():
        req = urllib.request.Request(url, headers={"User-Agent": "mizan-corpus-builder"})
        with urllib.request.urlopen(req, timeout=120) as r:
            path.write_bytes(r.read())
    data = path.read_bytes()
    return data, hashlib.sha256(data).hexdigest()


def quran_passages(downloads: list[dict]) -> list[dict]:
    raw, sha = fetch(TANZIL_URL.format(t="simple"), "quran-simple.xml")
    downloads.append({"source_id": "tanzil-simple", "url": TANZIL_URL.format(t="simple"), "sha256": sha})
    root = ET.fromstring(raw)
    out = []
    for sura in root.iter("sura"):
        s = int(sura.get("index"))
        for aya in sura.iter("aya"):
            a = int(aya.get("index"))
            text = aya.get("text")
            out.append(
                {
                    "key": f"quran:{s}:{a}",
                    "source_id": "tanzil-simple",
                    "collection": "quran",
                    "kind": "quran",
                    "book": s,
                    "number": a,
                    "number_label": f"{s}:{a}",
                    "numbering_scheme": "رقم السورة:رقم الآية (المصحف)",
                    "text_ar": text,
                    "text_en": None,
                    "gradings": [],
                    "url": f"https://quran.com/{s}/{a}",
                    "extra": {"sura_name": sura.get("name")},
                }
            )
    return out


def hadith_passages(downloads: list[dict]) -> list[dict]:
    out = []
    for book in HADITH_BOOKS:
        ara_raw, ara_sha = fetch(HADITH_URL.format(e=f"ara-{book}"), f"ara-{book}.json")
        eng_raw, eng_sha = fetch(HADITH_URL.format(e=f"eng-{book}"), f"eng-{book}.json")
        downloads += [
            {"source_id": "hadith-api", "url": HADITH_URL.format(e=f"ara-{book}"), "sha256": ara_sha},
            {"source_id": "hadith-api", "url": HADITH_URL.format(e=f"eng-{book}"), "sha256": eng_sha},
        ]
        ara = json.loads(ara_raw)["hadiths"]
        eng = {h["hadithnumber"]: (h.get("text") or "").strip() for h in json.loads(eng_raw)["hadiths"]}
        for h in ara:
            text = (h.get("text") or "").strip()
            if not text:
                continue
            an = h.get("arabicnumber")
            has_an = an not in (None, "", 0, "0")
            label = str(an if has_an else h["hadithnumber"])
            out.append(
                {
                    "key": f"{book}:{label}",
                    "source_id": "hadith-api",
                    "collection": book,
                    "kind": "hadith",
                    "book": (h.get("reference") or {}).get("book"),
                    "number": int(float(label)),
                    "number_label": label,
                    "numbering_scheme": "الترقيم العربي (hadith-api)" if has_an else "ترقيم hadith-api",
                    "text_ar": text,
                    "text_en": eng.get(h["hadithnumber"]) or None,
                    "gradings": [{"scholar": g["name"], "grade": g["grade"]} for g in h.get("grades") or []],
                    "url": None,
                    "extra": {"hadithnumber": h["hadithnumber"], "reference": h.get("reference")},
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
    for collection, phrase in FIXTURE_PHRASES:
        needle = normalize(phrase)
        hits = [p for p in passages if p["collection"] == collection and needle in p["text_ar_norm"]]
        keep += hits[:2]
    seen, unique = set(), []
    for p in keep:
        if p["key"] not in seen:
            seen.add(p["key"])
            unique.append(p)
    return unique


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", required=True, help="corpus version id, e.g. 2026-10-04")
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
        "sources": SOURCES,
        "downloads": downloads,
        "counts": counts,
        "notices": [TANZIL_NOTICE],
    }

    if args.fixture:
        fixture = build_fixture(passages)
        for i, p in enumerate(fixture, start=1):
            p["id"] = i
        fields = ("id", "collection", "kind", "book", "number", "numbering_scheme", "text_ar", "text_en",
                  "gradings", "url", "text_ar_norm", "text_en_norm")
        out = ROOT / "app" / "data" / "fixture_passages.json"
        out.write_text(
            json.dumps(
                {
                    "corpus_version": f"{args.version}-fixture",
                    "notices": [TANZIL_NOTICE, "Hadith: fawazahmed0/hadith-api (Unlicense)."],
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
