"""Fair reference check for any system's answers: does the reference it gives actually contain the quote?

    python -m scripts.ref_validity --responses ../../eval/results/responses-baseline-plain-test --split test

The gold set lists one reference per quote, but many hadith appear in several collections or several places in
one collection, so "equals the gold reference" under-counts correct answers. Here a reference is valid when the
passage it points to (collection + number, or surah:ayah) contains the quoted text, allowing a changed wording
(same rule Mizan uses for "wording differs"). Only the FIRST reference of an answer is checked, so a system that
lists several references gets no advantage.

Caveat: references are resolved with the corpus' numbering (hadith-api). A correct number from another edition's
numbering counts as invalid here; the report lists every invalid reference so they can be reviewed by hand.
"""

import argparse
import importlib.util
import json
from pathlib import Path

from app.align import compare
from app.normalize import normalize
from app.references import COLLECTIONS, QURAN, surahs
from app.retrieve import load_corpus_jsonl

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]


def load_run_eval():
    spec = importlib.util.spec_from_file_location("run_eval", REPO / "eval" / "run_eval.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def resolve(ref: str, index: dict) -> list:
    """'صحيح البخاري 13' or 'البقرة: 255' -> passages (several rows can share an integer number)."""
    ref = ref.split("؛")[0].split(";")[0].strip()
    if ":" in ref:
        name, _, ayah = ref.rpartition(":")
        n = normalize(name)
        surah = next((s.number for s in surahs() if normalize(s.name) == n), None)
        digits = "".join(ch for ch in ayah if ch.isdigit())
        return index.get((QURAN, surah, int(digits)), []) if surah and digits else []
    head, _, num = ref.rpartition(" ")
    digits = num.split(".")[0]
    key = next((c.key for c in COLLECTIONS.values() if normalize(c.label) == normalize(head)), None)
    return index.get((key, None, int(digits)), []) if key and digits.isdigit() else []


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--responses", required=True, help="dir with run1/<case id>.json")
    ap.add_argument("--gold", default=str(REPO / "eval" / "gold.jsonl"))
    ap.add_argument("--split", default="test")
    ap.add_argument("--version", default="2026-10-04")
    args = ap.parse_args()

    run_eval = load_run_eval()
    index: dict = {}
    for p in load_corpus_jsonl(ROOT / "data" / "corpus" / args.version / "passages.jsonl"):
        key = (p.collection, p.book, p.number) if p.collection == QURAN else (p.collection, None, p.number)
        index.setdefault(key, []).append(p)

    cases = [json.loads(x) for x in Path(args.gold).read_text(encoding="utf-8").splitlines() if x.strip()]
    cases = [c for c in cases if args.split == "all" or c["split"] == args.split]
    checked = valid = missing = 0
    rows = []
    for c in cases:
        resp = json.loads((Path(args.responses) / "run1" / f"{c['id']}.json").read_text(encoding="utf-8"))
        for e, f in run_eval.match(c["expected"], resp["findings"]):
            if not e.get("reference") or e["status"] == "not_found":
                continue  # only quotes that do exist in the corpus have a correct reference to give
            ref = (f or {}).get("suggested_reference") or ""
            if not ref:
                missing += 1
                rows.append((c["id"], e["quote"][:60], "-", "no reference given"))
                continue
            checked += 1
            passages = resolve(ref, index)
            ok = any(compare(e["quote"], p, 92, 75).match_type is not None for p in passages)
            valid += ok
            if not ok:
                rows.append((c["id"], e["quote"][:60], ref.split("؛")[0], "not found at that reference" if passages else "reference not in corpus"))

    total = checked + missing
    print(f"references expected: {total}")
    print(f"valid (passage contains the quote): {valid}/{total} = {valid / max(1, total):.3f}")
    print(f"given but invalid: {checked - valid} | none given: {missing}")
    for r in rows:
        print(" | ".join(r))


if __name__ == "__main__":
    main()
