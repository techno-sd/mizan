"""Run the pipeline on a text from the command line, rules-only, without a database.

    python -m scripts.demo                                  # demo script, small fixture corpus
    python -m scripts.demo path/to/file.txt                 # your text, fixture corpus
    python -m scripts.demo path/to/file.txt --corpus 2026-10-04   # full built corpus (IndexedRetriever)
"""

import argparse
import asyncio
from pathlib import Path

from app.config import Settings
from app.pipeline import Pipeline
from app.retrieve import IndexedRetriever, InMemoryRetriever, load_corpus_jsonl, load_fixture
from app.store import MemoryStore

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT.parents[1] / "eval" / "demo_script_ar.txt"


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("file", nargs="?", default=str(DEMO))
    ap.add_argument("--corpus", help="corpus version to load from data/corpus/<version>/passages.jsonl")
    args = ap.parse_args()
    text = Path(args.file).read_text(encoding="utf-8")
    if args.corpus:
        retriever = IndexedRetriever(load_corpus_jsonl(ROOT / "data" / "corpus" / args.corpus / "passages.jsonl"))
    else:
        retriever = InMemoryRetriever(load_fixture())
    pipeline = Pipeline(Settings(_env_file=None), retriever, MemoryStore(), llm=None)
    resp = await pipeline.verify(text, debug=False)
    print(f"items={resp.summary.total} {resp.summary.by_status} review={resp.summary.needs_scholar_review}")
    for f in resp.findings:
        print("-" * 80)
        print(f"[{f.status.value}] ({f.type.value}) «{f.quoted_text[:70]}» cited={f.cited_reference!r}")
        if f.evidence:
            e = f.evidence[0]
            print(f"   evidence: {e.reference}  sim={e.similarity} match={e.match_type.value}")
        if f.suggested_reference:
            print(f"   suggested: {f.suggested_reference}")
        if f.diff and any(d.op != "equal" for d in f.diff):
            print("   diff: " + " ".join(f"[{d.op}:{d.text}]" if d.op != "equal" else d.text for d in f.diff)[:300])
        for g in f.gradings:
            print(f"   grade: {g.scholar_ar or g.scholar} -> {g.grade_ar or g.grade} ({g.category})")
        if f.nearest:
            print(f"   nearest (different text): {f.nearest.reference} sim={f.nearest.similarity}")
        for n in f.notes + f.review_reasons:
            print(f"   note: {n}")


if __name__ == "__main__":
    asyncio.run(main())
