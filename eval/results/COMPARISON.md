# Mizan vs. a general AI model (held-out test split, approved sources)

Run on 2026-10-05, commit `a801ab2`, corpus `2026-10-05`: **only the challenge's approved sources**
(QuranEnc for the Quran, HadeethEnc for hadith with its takhrij and ruling). Test split of the gold set:
29 cases, 33 quotes, never used for tuning. Same model everywhere: **Claude Sonnet 5.5**.

- **Mizan**: the deployed service (Vercel → Render → Supabase, Frankfurt), 3 runs.
- **Claude, directly**: the same model given the same text and asked, in Arabic, for each quote's status and correct
  reference as JSON (`eval/baselines/run_baseline.mjs --variant plain`).
- **Claude + web search**: same prompt with Anthropic's web search tool (`--variant search`).

All are scored by the same code (`eval/run_eval.py` for statuses, `services/api/scripts/ref_validity.py` for
references).

| Metric | **Mizan** | Claude, directly | Claude + web search |
|---|---|---|---|
| Status accuracy | **97.0%** (32/33) | 84.8% (28/33) | 87.9% (29/33) |
| False support (said "matches" when it doesn't) | **0%** | 0% | 0% |
| Reference agrees with the approved source (book for hadith, surah:ayah for Quran; first reference only) | **100%** (27/27) | 92.6% (25/27) | 92.6% (25/27) |
| No reference given for a quote that exists | **0** | 1 | 2 |
| Same result across 3 runs | **100%** | not measured | not measured |
| Median time per case | **1.4 s** | 3.8 s | 4.5 s |
| Shows the approved text, the word diff, the takhrij and the ruling | **yes** | no | no |

## What this does and does not show

- The general model is **good**: it never said "matches" wrongly and named the right book most of the time.
  Mizan's advantage here is consistency and traceability rather than a large accuracy gap: every status follows a
  fixed rule, every reference is the approved takhrij, and the same text gives the same answer.
- The general model's status errors were mostly on Uthmani verse text copied from the mushaf (called "wording
  differs") and on hadith wording, where it judged without the source text in front of it.
- Mizan's one error (`g-050`) is a gold-set artifact: the generated excerpt starts mid-honorific («وسلم يصلي…»),
  and Mizan correctly reports the stray word.
- **The gold set favours Mizan**: it is generated from the same approved corpus Mizan searches. References are
  checked at book level for hadith, because the approved source gives its takhrij by book.
- **Small sample**: 33 quotes. The result is an indication, not a general claim.

## What a user gets that a chat answer does not give

- the approved text, highlighted, with its context (previous/next ayah, the full hadith on demand);
- the word-by-word difference between what was written and the source;
- the approved takhrij and ruling of each hadith, with a link to the encyclopedia;
- the same answer every time, a declared set of approved sources, and no reference that can be invented.

Reproduce: see [docs/EVALUATION.md](../../docs/EVALUATION.md).
