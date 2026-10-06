"""Evaluate the pipeline in-process over the full built corpus (no database, no HTTP).

    python -m scripts.eval_offline --version 2026-10-04 --split dev [--limit 20]

Uses IndexedRetriever and rules-only mode unless ANTHROPIC_API_KEY is set. Scoring is shared with eval/run_eval.py.
"""

import argparse
import asyncio
import importlib.util
import json
import os
import time
from pathlib import Path

from app.config import Settings
from app.llm import ClaudeClient
from app.pipeline import Pipeline
from app.retrieve import IndexedRetriever, load_corpus_jsonl
from app.store import MemoryStore

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]


def load_run_eval():
    spec = importlib.util.spec_from_file_location("run_eval", REPO / "eval" / "run_eval.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", default="2026-10-04")
    ap.add_argument("--gold", default=str(REPO / "eval" / "gold.jsonl"))
    ap.add_argument("--split", default="dev")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--out", default=str(REPO / "eval" / "results"))
    args = ap.parse_args()

    run_eval = load_run_eval()
    t0 = time.perf_counter()
    passages = load_corpus_jsonl(ROOT / "data" / "corpus" / args.version / "passages.jsonl")
    retriever = IndexedRetriever(passages)
    print(f"corpus {len(passages)} passages indexed in {time.perf_counter() - t0:.1f}s")

    settings = Settings(_env_file=None, corpus_version=args.version)
    store = MemoryStore()
    llm = (
        ClaudeClient(store, settings.llm_model, cache_enabled=settings.llm_cache_enabled)
        if settings.llm_enabled and os.environ.get("ANTHROPIC_API_KEY") else None
    )
    pipeline = Pipeline(settings, retriever, store, llm)

    cases = [json.loads(x) for x in Path(args.gold).read_text(encoding="utf-8").splitlines() if x.strip()]
    if args.split != "all":
        cases = [c for c in cases if c["split"] == args.split]
    if args.limit:
        cases = cases[: args.limit]

    pairs_all, per_cat, failures, latencies = [], {}, [], []
    for c in cases:
        t = time.perf_counter()
        resp = await pipeline.verify(c["text"])
        latencies.append(time.perf_counter() - t)
        findings = [f.model_dump(mode="json") for f in resp.findings]
        pairs = run_eval.match(c["expected"], findings)
        pairs_all += pairs
        per_cat.setdefault(c["category"], []).extend(pairs)
        for e, f in pairs:
            got = f["status"] if f else "missed"
            ref_ok = (not e.get("reference")) or (f and run_eval.norm(e["reference"]) in run_eval.norm(f.get("suggested_reference") or ""))
            if got != e["status"] or not ref_ok:
                failures.append(
                    {"id": c["id"], "category": c["category"], "quote": e["quote"][:80], "gold": e["status"],
                     "got": got, "gold_ref": e.get("reference"), "got_ref": f and f.get("suggested_reference")}
                )
        print(f"{c['id']} {c['category']:<24} {time.perf_counter() - t:5.1f}s", flush=True)

    summary = run_eval.score(pairs_all)
    summary["latency_mean_s"] = round(sum(latencies) / max(1, len(latencies)), 2)
    summary["llm"] = llm.model if llm else "rules-only"
    by_cat = {cat: run_eval.score(p)["status_accuracy"] for cat, p in per_cat.items()}

    lines = [f"# Offline eval: {args.split} ({summary['llm']}, corpus {args.version})", "",
             f"Cases: {len(cases)} · items: {summary['items']}", "", "| metric | value |", "|---|---|"]
    lines += [f"| {k} | {v} |" for k, v in summary.items() if k != "items"]
    lines += ["", "| category | status accuracy |", "|---|---|"] + [f"| {k} | {v} |" for k, v in by_cat.items()]
    lines += ["", f"## Failures ({len(failures)})", "", "| id | category | quote | gold | got | gold ref | got ref |",
              "|---|---|---|---|---|---|---|"]
    lines += [f"| {x['id']} | {x['category']} | {x['quote']} | {x['gold']} | {x['got']} | {x['gold_ref']} | {x['got_ref']} |"
              for x in failures]
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    tag = "rules" if llm is None else "llm"
    (out / f"{args.split}-offline-{tag}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines[:20]))


if __name__ == "__main__":
    asyncio.run(main())
