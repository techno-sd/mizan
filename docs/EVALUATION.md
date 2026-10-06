# Evaluation

What was measured, how to reproduce it, and what each number does not show. Small sets: they are indications, not
general accuracy claims. File-level details: [eval/README.md](../eval/README.md).

## 1. Sets

| Set | File | Size | What it asks | Labels |
|---|---|---|---|---|
| Gold | `eval/gold.jsonl` | 105 cases, 125 quotes; `dev` 76 (tuning) / `test` 29 (held out) | exact and altered hadith, wrong collection, weak texts, sayings not in the corpus, correct and wrong verses, English quotes, longer scripts | generated from the corpus by `eval/build_gold.mjs` (deterministic): objective, but favours Mizan because every "exists" item is in its corpus |
| Word fidelity | `eval/fidelity.jsonl` | 40 | real ayat and hadith, half changed by one word the way people misquote from memory | objective: every changed text occurs nowhere in the corpus |
| Popular claims | `eval/challenge.jsonl` | 37 | baseless sayings, authentic hadith cited to the wrong book, verse errors, correct controls | from the standard works on weak and fabricated hadith; **pending specialist review** |
| Regression | `eval/adversarial.jsonl` | 6 | cases found after release (Quran alef forms, emoji offsets) | written by hand |

The `test` split is not looked at while tuning thresholds or prompts. Gold item format:
[`eval/gold.example.jsonl`](../eval/gold.example.jsonl).

## 2. Metrics (`eval/run_eval.py`)

| Metric | Definition |
|---|---|
| **False support rate** (north star) | share of `matches_source` predictions whose gold status differs; target ≤ 2% |
| Status accuracy | matched items with the gold status |
| Detection recall | expected items found at all |
| Abstention recall | gold `not_found` items not matched to a source |
| Reference accuracy | gold reference contained in the suggested reference (`ref_validity.py` for baselines) |
| Consistency | items with identical status across 3 runs. With the LLM cache on this is **repeatability, not independent model stability**; set `MIZAN_LLM_CACHE_ENABLED=false` to measure the latter |
| Fabricated references | references not present in the corpus: **0 by construction** (references come from the database) |

## 3. Results

All against the live service with Claude Sonnet 5.5 unless noted. Full per-case tables are in `eval/results/`.

| Date | Set | Mizan | Same model used directly | Notes |
|---|---|---|---|---|
| 2026-10-05 | Gold `test`, approved corpus (33 quotes) | status **32/33** (97.0%), false support **0%**, references **27/27**, 3 runs identical | 28/33 without tools, 29/33 with web search; references 25/27; 0% false support | [COMPARISON.md](../eval/results/COMPARISON.md). The one miss, `g-050`, is a gold artifact (excerpt starting mid-honorific) |
| 2026-10-05 | Gold `dev`, approved corpus (92 quotes) | status 98.9%, false support 0%, abstention 100%, references 100% | | [HISTORY.md](../eval/results/HISTORY.md) |
| 2026-10-05 | Word fidelity (40) | **40/40**, 3 runs identical | **31/40**: flagged 7 of 10 correctly quoted hadith as altered | [FIDELITY.md](../eval/results/FIDELITY.md) |
| 2026-10-05 | Popular claims (37) | **37/37**, 0 invented references, 3 runs identical | 36/37 (missed «وقل **ربي** زدني علما»), 0 invented references | [CHALLENGE.md](../eval/results/CHALLENGE.md) |
| 2026-10-06 | Word fidelity, regression, gold `dev`; pipeline 0.2.1, corpus `2026-10-05.2`, **rules-only**, offline | fidelity 40/40; regression 6/6; dev: 88/92 detected, 88/88 of those correct, no false support | | [release-2026-10-06](../eval/results/release-2026-10-06/README.md). The four undetected quotes are English Quran excerpts that need model extraction |

What this shows:

- On **famous** baseless sayings a strong model is already reliable (it knew all 13). Mizan's value there is
  consistency and the evidence it shows, not a large accuracy gap.
- On **wording**, a model without the source text cannot confirm a hadith word for word: it misses small changes or,
  more often, tells the writer to "correct" a hadith quoted exactly. Mizan compares against the approved text.
- Several of the general model's "invalid" references are other narrations of the same hadith; a human reviewer
  would accept some of them.

## 4. Limits of these numbers

- **Historical:** the live comparisons above were run before pipeline 0.2.1 and before later changes (source
  ranking, the locate-then-verify step, translated verses). They must be rerun before being presented as
  measurements of the current build.
- **Corpus-derived sets favour Mizan** (the texts are ones it holds, in its numbering). Independent, human-written
  examples have not been collected.
- **No uncached full-model run** exists, so independent model stability and cold latency are unmeasured.
- Not done: the target-user test ([eval/user_test.md](../eval/user_test.md)) and the specialist review
  ([eval/specialist_review.md](../eval/specialist_review.md)). Automated tests are separate evidence from both.
- Report counts next to percentages, with the date and the corpus version.

## 5. Reproduce

```bash
# Re-score saved answers (no API needed)
node eval/score_fidelity.mjs && node eval/score_challenge.mjs

# Live API, 3 runs (needs MIZAN_INTERNAL_API_KEY)
python eval/run_eval.py --api https://mizan-api-dslz.onrender.com --key "$KEY" --gold eval/gold.jsonl --split test --runs 3

# Offline, without the model or the database (from services/api)
MIZAN_LLM_ENABLED=false MIZAN_DATABASE_URL= python -m scripts.eval_offline --version 2026-10-05.2 \
  --gold ../../eval/fidelity.jsonl --split fidelity

# The same model used directly, for comparison
node eval/baselines/run_baseline.mjs --split test --variant plain     # or --variant search
node eval/baselines/run_baseline.mjs --gold eval/fidelity.jsonl --split fidelity
```

**Rule:** no change to thresholds, prompts or sources ships without an eval run on `dev`, and the false support rate
must not rise.
