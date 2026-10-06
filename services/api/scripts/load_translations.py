"""Load approved QuranEnc translations into quran_translations (see db/migrations/*_quran_translations.sql).

    python -m scripts.fetch_translations   # (node scripts/fetch_translations.mjs) downloads them into .cache/sources
    python -m scripts.load_translations    # reads MIZAN_DATABASE_URL from the environment or .env

Uses the direct (non-pooler) host. Replaces the rows of each language it loads.
"""

import json
import os
import re
from pathlib import Path

import psycopg

from app.normalize import normalize

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "sources"
TRANSLATIONS = {
    "en": "english_saheeh", "fr": "french_rashid", "es": "spanish_garcia", "de": "german_bubenheim",
    "id": "indonesian_affairs", "tr": "turkish_rwwad", "ur": "urdu_junagarhi",
}
_FOOTNOTE = re.compile(r"\[\d+\]")


def database_url() -> str:
    url = os.environ.get("MIZAN_DATABASE_URL", "")
    if not url and (ROOT / ".env").exists():
        for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
            if line.startswith("MIZAN_DATABASE_URL="):
                url = line.split("=", 1)[1].strip()
    if not url:
        raise SystemExit("MIZAN_DATABASE_URL is not set")
    return url.replace("-pooler.", ".")


def rows(lang: str, key: str):
    data = json.loads((CACHE / f"quranenc-{key}.json").read_text(encoding="utf-8"))
    for ayat in data["suras"].values():
        for a in ayat:
            text = re.sub(r"\s+", " ", _FOOTNOTE.sub("", a.get("translation") or "")).strip()
            text = re.sub(r"^\d+\.\s*", "", text)  # some translations start each ayah with its number («256. »)
            if text:
                yield lang, int(a["sura"]), int(a["aya"]), key, text, normalize(text)


def main() -> None:
    with psycopg.connect(database_url()) as conn:
        for lang, key in TRANSLATIONS.items():
            if not (CACHE / f"quranenc-{key}.json").exists():
                print(f"{lang}: {key} not downloaded, skipped")
                continue
            conn.execute("delete from quran_translations where lang = %s", (lang,))
            with conn.cursor().copy(
                "copy quran_translations (lang, sura, aya, translation_key, text, text_norm) from stdin"
            ) as copy:
                n = 0
                for r in rows(lang, key):
                    copy.write_row(r)
                    n += 1
            conn.commit()
            print(f"{lang}: {n} ayat ({key})")
        conn.execute("analyze quran_translations")


if __name__ == "__main__":
    main()
