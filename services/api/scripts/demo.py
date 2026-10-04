"""Run the pipeline on a text from the command line (offline fixture unless MIZAN_DATABASE_URL is set).

    python -m scripts.demo                 # built-in demo script
    python -m scripts.demo path/to/file.txt
"""

import asyncio
import sys
from pathlib import Path

from app.config import get_settings
from app.pipeline import Pipeline
from app.retrieve import InMemoryRetriever, load_fixture
from app.store import MemoryStore

DEMO = Path(__file__).resolve().parents[3] / "eval" / "demo_script_ar.txt"


async def main() -> None:
    text = Path(sys.argv[1]).read_text(encoding="utf-8") if len(sys.argv) > 1 else DEMO.read_text(encoding="utf-8")
    pipeline = Pipeline(get_settings(), InMemoryRetriever(load_fixture()), MemoryStore(), llm=None)
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
