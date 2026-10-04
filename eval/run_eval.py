"""Evaluate a running Mizan API against a gold set. Standard library only.

    python eval/run_eval.py --api http://localhost:8000 --gold eval/gold.jsonl --split test --runs 3

Gold format: see eval/gold.example.jsonl. Each case is an input text plus the items a reviewer expects.
Expected items are matched to predicted findings by quote similarity.

Metrics (per run, then averaged; consistency is across runs):
  detection_recall    expected items that Mizan found at all
  status_accuracy     matched items whose status equals the gold status
  false_support_rate  of items Mizan marked matches_source, the share whose gold status is different (north star)
  abstention_recall   gold not_found items that Mizan did not match to a source
  reference_accuracy  gold reference contained in Mizan's suggested reference
  review_recall       gold needs_review items that Mizan flagged for review
  consistency         items with the same status in every run
"""

import argparse
import json
import re
import statistics
import time
import urllib.request
from difflib import SequenceMatcher
from pathlib import Path

_DIAC = re.compile("[ؐ-ًؚ-ٰٟۖ-ۭـ]")


def norm(s: str) -> str:
    s = _DIAC.sub("", s or "")
    s = s.translate(str.maketrans("أإآٱىة", "اااايه"))
    return " ".join(re.sub(r"[^\w]+", " ", s.lower()).split())


def similar(a: str, b: str) -> float:
    a, b = norm(a), norm(b)
    if not a or not b:
        return 0.0
    if a in b or b in a:
        return 1.0
    return SequenceMatcher(None, a, b).ratio()


def call(api: str, key: str, text: str) -> dict:
    req = urllib.request.Request(
        f"{api.rstrip('/')}/v1/verify",
        data=json.dumps({"text": text}).encode("utf-8"),
        headers={"content-type": "application/json", "x-internal-key": key},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read())


def match(expected: list[dict], findings: list[dict]) -> list[tuple[dict, dict | None]]:
    used: set[int] = set()
    pairs = []
    for e in expected:
        best, best_i = 0.0, None
        for i, f in enumerate(findings):
            if i in used:
                continue
            s = similar(e["quote"], f["quoted_text"])
            if s > best:
                best, best_i = s, i
        if best_i is not None and best >= 0.8:
            used.add(best_i)
            pairs.append((e, findings[best_i]))
        else:
            pairs.append((e, None))
    return pairs


def score(pairs: list[tuple[dict, dict | None]]) -> dict:
    found = [(e, f) for e, f in pairs if f]
    said_match = [(e, f) for e, f in found if f["status"] == "matches_source"]
    gold_nf = [(e, f) for e, f in pairs if e["status"] == "not_found"]
    with_ref = [(e, f) for e, f in found if e.get("reference")]
    gold_review = [(e, f) for e, f in found if e.get("needs_review")]

    def ratio(n: int, d: int) -> float | None:
        return round(n / d, 3) if d else None

    return {
        "items": len(pairs),
        "detection_recall": ratio(len(found), len(pairs)),
        "status_accuracy": ratio(sum(e["status"] == f["status"] for e, f in found), len(found)),
        "false_support_rate": ratio(sum(e["status"] != "matches_source" for e, _ in said_match), len(said_match)),
        "abstention_recall": ratio(
            sum(f is None or f["status"] in ("not_found", "out_of_scope") for _, f in gold_nf), len(gold_nf)
        ),
        "reference_accuracy": ratio(
            sum(norm(e["reference"]) in norm(f.get("suggested_reference") or "") for e, f in with_ref), len(with_ref)
        ),
        "review_recall": ratio(sum(bool(f["needs_scholar_review"]) for _, f in gold_review), len(gold_review)),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://localhost:8000")
    ap.add_argument("--key", default="")
    ap.add_argument("--gold", default="eval/gold.jsonl")
    ap.add_argument("--split", default="dev", help="dev | test | all")
    ap.add_argument("--runs", type=int, default=3)
    ap.add_argument("--out", default="eval/results")
    args = ap.parse_args()

    cases = [json.loads(line) for line in Path(args.gold).read_text(encoding="utf-8").splitlines() if line.strip()]
    if args.split != "all":
        cases = [c for c in cases if c.get("split") == args.split]

    runs, statuses = [], {}
    for r in range(args.runs):
        pairs_all, latencies = [], []
        for c in cases:
            t0 = time.perf_counter()
            resp = call(args.api, args.key, c["text"])
            latencies.append(time.perf_counter() - t0)
            pairs = match(c["expected"], resp["findings"])
            pairs_all += pairs
            for i, (e, f) in enumerate(pairs):
                statuses.setdefault(f"{c['id']}#{i}", []).append(f["status"] if f else None)
        s = score(pairs_all)
        s["latency_p50_s"] = round(statistics.median(latencies), 2) if latencies else None
        runs.append(s)
        print(f"run {r + 1}: {s}")

    consistency = round(sum(len(set(v)) == 1 for v in statuses.values()) / max(1, len(statuses)), 3)
    keys = [k for k in runs[0] if k != "items"]
    summary = {k: (round(statistics.mean(x[k] for x in runs if x[k] is not None), 3)
                   if any(x[k] is not None for x in runs) else None) for k in keys}
    summary["consistency_across_runs"] = consistency
    summary["cases"], summary["items"], summary["runs"] = len(cases), runs[0]["items"], args.runs

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    (out / f"{args.split}-{stamp}.json").write_text(json.dumps({"summary": summary, "runs": runs}, indent=2))
    lines = [f"# Eval {args.split} ({stamp})", "", "| metric | value |", "|---|---|"]
    lines += [f"| {k} | {v} |" for k, v in summary.items()]
    (out / f"{args.split}-latest.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
