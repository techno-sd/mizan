# Evaluation history

All runs: rules-only (no Claude), full corpus `2026-10-04` (42,300 passages), in-process
(`python -m scripts.eval_offline`). **Dev split only**: the fixes below were made by looking at dev failures, so
these numbers are optimistic. The held-out test split is run once, at the end (Day 3).

| Date | Commit | Split | Items | False support ↓ | Status acc. | Abstention | Reference acc. | Detection |
|---|---|---|---|---|---|---|---|---|
| 2026-10-04 12:26 | `c24da01` | dev | 88 | **18.0%** | 84.1% | 50% | 100% | 100% |
| 2026-10-04 13:00 | `f529217` | dev | 88 | **0.0%** | 98.9% | 100% | 100% | 100% |

## What changed between the two runs

| Failure seen on dev | Fix | Commit |
|---|---|---|
| One added/replaced word still scored "matches source" (character similarity ≥ 92) | "matches" now requires a word-for-word match after normalization; honorifics ignored | `e296b4a` |
| Short sayings matched unrelated texts («النظافة من الإيمان» ↔ «البذاذة من الإيمان») | variant needs ≥ 3 shared words, ≥ 60% of the quote and ≥ 70% of the source window | `e296b4a` |
| «[طه: 70]» not parsed (2-letter surah names skipped) | short names accepted when followed by an ayah number; surah+ayah checked as a pair | `e296b4a` |
| «الإيمان يمان…» cited to Muslim accepted because Muslim has a different hadith with overlapping words | same window-share rule | `e296b4a` |
| Exact wording only in an-Nasa'i while the cited Sahihs differ was "matches source" (found on the user-test script) | wording judged against the cited collection, with a note | `f529217` |

## Remaining dev failure

- `g-009`: the generated excerpt ends with «… للنبي صلى», cut in the middle of «صلى الله عليه وسلم». The pipeline
  reports the dangling «صلى» as an added word. This is a gold-generation artifact (no writer ends a quote there); the
  gold set was not changed to avoid tuning on it.

Latency in this table is from a WebAssembly Python runtime with pure-Python fuzzy matching (≈ 9.5 s per case); the
deployed service uses native CPython and RapidFuzz's compiled implementation.
