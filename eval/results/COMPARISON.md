# Mizan vs. a general AI model (held-out test split)

Run on 2026-10-05, commit `67f3a92`, test split of the gold set (28 cases, 32 quotes) that was not used for any
tuning. Same model everywhere: **Claude Sonnet 5.5**.

- **Mizan**: the deployed service (Vercel → Render → Supabase, Frankfurt), 3 runs.
- **Claude, directly**: the same model given the same text and asked, in Arabic, for each quote's status and correct
  reference as JSON (`eval/baselines/run_baseline.mjs --variant plain`).
- **Claude + web search**: same prompt with Anthropic's web search tool (`--variant search`).

All three are scored by the same code (`eval/run_eval.py`, `services/api/scripts/ref_validity.py`).

| Metric | **Mizan** | Claude, directly | Claude + web search |
|---|---|---|---|
| Status accuracy | **100%** (32/32) | 90.6% (29/32) | 87.5% (28/32) |
| False support (said "matches" when it doesn't) | **0%** | 0% | 0% |
| Valid reference: the passage it points to contains the quote (first reference only) | **100%** (27/27) | 70% (19/27) | 70% (19/27) |
| No reference given for a quote that exists | **0** | 4 | 3 |
| "Not found" for a text that is in the collections | **0** | 1 | 2 |
| Same result across 3 runs | **100%** | not measured | not measured |
| Median time per case | **1.4 s** | 4.8 s | 4.8 s |
| Shows the source passage, the word diff, and scholars' gradings | **yes** | no | no |

## What this does and does not show

- The general model is **strong on statuses** for this kind of text. Its weak point is the **reference**: a third of
  its references are missing or do not point to a passage containing the quote, and it twice called an existing
  (weakly graded) hadith "not found". Mizan's references are resolved from the corpus by construction.
- Several of the general model's "invalid" references are **other narrations of the same hadith** with different
  wording (e.g. al-Bukhari 1463 vs 1464, 5500 vs 985). The automatic check counts them as invalid because the
  quoted words are not at that place. A human reviewer would accept some of them; the honest range for the
  baseline is roughly **70–85% valid references**, and the cases are listed in the run output.
- **The gold set favours Mizan**: it is generated from the same corpus Mizan searches, so every "exists" item is
  in Mizan's corpus by construction, and its numbering is the corpus' numbering. A correct reference in another
  edition's numbering counts against the baseline.
- **Small sample**: 32 quotes. The result is an indication, not a general claim.

## What a user gets that a chat answer does not give

- the exact source passage, highlighted, with its context (previous/next ayah, full hadith on demand);
- the word-by-word difference between what was written and the source;
- the scholars' gradings, attributed by name;
- the same answer every time, a declared corpus, and no reference that can be invented.

Reproduce: see [docs/EVALUATION.md](../../docs/EVALUATION.md).
