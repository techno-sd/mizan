"""Fair reference check for any system's answers against the approved sources.

    python -m scripts.ref_validity --responses ../../eval/results/responses-baseline-plain-test --split test

A reference is valid when it points where the approved sources say the text is:
  * Quran: the same surah and ayah.
  * Hadith: it names at least one book, and every book it names appears in the approved takhrij
    (HadeethEnc), e.g. «صحيح البخاري 1» is valid for a hadith whose takhrij is «متفق عليه».
Only the FIRST reference of an answer is checked, so a system that lists several references gets no advantage.
Hadith numbers are not checked: the approved source gives the takhrij by book, and numbering differs by edition.
"""

import argparse
import importlib.util
import json
from pathlib import Path

from app.references import QURAN, parse_cited_reference

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]


def load_run_eval():
    spec = importlib.util.spec_from_file_location("run_eval", REPO / "eval" / "run_eval.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def valid(given: str, gold: str, kind: str) -> bool:
    first = given.split("؛")[0].split(";")[0].strip()
    g, t = parse_cited_reference(first), parse_cited_reference(gold)
    if g is None or t is None:
        return False
    if kind == "quran" or QURAN in t.collections:
        return (g.surah, g.ayah) == (t.surah, t.ayah) and g.surah is not None
    books = [c for c in g.collections if c != QURAN]
    return bool(books) and set(books) <= set(t.collections)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--responses", required=True, help="dir with run1/<case id>.json")
    ap.add_argument("--gold", default=str(REPO / "eval" / "gold.jsonl"))
    ap.add_argument("--split", default="test")
    args = ap.parse_args()

    run_eval = load_run_eval()
    cases = [json.loads(x) for x in Path(args.gold).read_text(encoding="utf-8").splitlines() if x.strip()]
    cases = [c for c in cases if args.split == "all" or c["split"] == args.split]
    ok = given_bad = missing = 0
    rows = []
    for c in cases:
        resp = json.loads((Path(args.responses) / "run1" / f"{c['id']}.json").read_text(encoding="utf-8"))
        for e, f in run_eval.match(c["expected"], resp["findings"]):
            if not e.get("reference") or e["status"] == "not_found":
                continue  # only quotes that exist in the approved sources have a correct reference
            kind = "quran" if parse_cited_reference(e["reference"]) and QURAN in parse_cited_reference(e["reference"]).collections else "hadith"
            ref = (f or {}).get("suggested_reference") or ""
            if not ref:
                missing += 1
                rows.append((c["id"], e["quote"][:60], "-", "no reference given"))
            elif valid(ref, e["reference"], kind):
                ok += 1
            else:
                given_bad += 1
                rows.append((c["id"], e["quote"][:60], ref.split("؛")[0][:60], f"approved: {e['reference'][:50]}"))
    total = ok + given_bad + missing
    print(f"references expected: {total}")
    print(f"valid against the approved sources: {ok}/{total} = {ok / max(1, total):.3f}")
    print(f"given but not matching the approved sources: {given_bad} | none given: {missing}")
    for r in rows:
        print(" | ".join(r))


if __name__ == "__main__":
    main()
