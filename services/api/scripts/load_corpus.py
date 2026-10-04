"""Load a built corpus into Supabase Postgres.

    MIZAN_DATABASE_URL=postgresql://... python -m scripts.load_corpus --version 2026-10-04

Use the direct (session) connection string for loading, not the transaction pooler.
Re-running for the same version replaces that version's passages.
"""

import argparse
import json
import os
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]
COLUMNS = (
    "corpus_version", "source_id", "collection", "kind", "book", "number", "number_label", "numbering_scheme",
    "text_ar", "text_ar_norm", "text_en", "text_en_norm", "gradings", "url", "extra",
)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", required=True)
    args = ap.parse_args()

    corpus_dir = ROOT / "data" / "corpus" / args.version
    manifest = json.loads((corpus_dir / "manifest.json").read_text(encoding="utf-8"))
    url = os.environ["MIZAN_DATABASE_URL"]

    with psycopg.connect(url, prepare_threshold=None) as conn:
        with conn.cursor() as cur:
            for sid, s in manifest["sources"].items():
                cur.execute(
                    "insert into sources (id, title, kind, url, license) values (%s, %s, %s, %s, %s) "
                    "on conflict (id) do update set title = excluded.title, url = excluded.url, "
                    "license = excluded.license",
                    (sid, s["title"], s["kind"], s["url"], s["license"]),
                )
            cur.execute(
                "insert into corpus_versions (id, manifest) values (%s, %s::jsonb) "
                "on conflict (id) do update set manifest = excluded.manifest",
                (args.version, json.dumps(manifest, ensure_ascii=False)),
            )
            cur.execute("delete from passages where corpus_version = %s", (args.version,))
            n = 0
            with (
                cur.copy(f"copy passages ({', '.join(COLUMNS)}) from stdin") as copy,
                (corpus_dir / "passages.jsonl").open(encoding="utf-8") as fh,
            ):
                for line in fh:
                    p = json.loads(line)
                    copy.write_row(
                        (
                            args.version, p["source_id"], p["collection"], p["kind"], p["book"], p["number"],
                            p["number_label"], p["numbering_scheme"], p["text_ar"], p["text_ar_norm"],
                            p["text_en"], p["text_en_norm"], json.dumps(p["gradings"], ensure_ascii=False),
                            p["url"], json.dumps(p["extra"], ensure_ascii=False),
                        )
                    )
                    n += 1
            cur.execute("analyze passages")
        conn.commit()
    print(f"loaded {n} passages into corpus_version={args.version}")


if __name__ == "__main__":
    main()
