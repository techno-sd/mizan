# Evaluation history

## Current: approved sources only (corpus `2026-10-05`, QuranEnc + HadeethEnc, 9,810 passages)

New gold set generated from the approved corpus (105 cases, 125 quotes; 76 dev / 29 test). Live API with
Claude Sonnet 5.5, 3 runs each.

| Date | Commit | Split | Items | False support ↓ | Status acc. | Abstention | Reference acc. | Consistency |
|---|---|---|---|---|---|---|---|---|
| 2026-10-05 12:16 | `c199f66` | dev | 92 | **0.0%** | 98.9% | 100% | 100% | 100% |
| 2026-10-05 12:40 | `a801ab2` | **test** (held out) | 33 | **0.0%** | **97.0%** | 100% | 100% | 100% |
| 2026-10-05 17:37 | `4f9208a` | **test**, corpus `2026-10-05.2` (approved + labelled hadith-api) | 33 | **0.0%** | **97.0%** | 100% | 100% | 100% |

Dev fix between the two: mushaf text copied without marks («الحيوة / الصلوة») is matched to the Uthmani rasm
(`a801ab2`). Test failure: `g-050`, a gold-set artifact (excerpt starting mid-honorific). Comparison with the
same model used directly: [COMPARISON.md](COMPARISON.md).

## Earlier runs

Before 2026-10-05 the corpus was Tanzil + hadith-api (2026-10-04). Those runs showed how the matching rules were
developed (false support 18.0% → 0.0% on dev after the word-for-word rule, then 0.0% on dev and test with Claude Sonnet
5.5 on the live API) and are not repeated here: those sources are no longer used and their result files were removed.
Latency in old runs came from a WebAssembly Python runtime with pure-Python fuzzy matching (≈ 9.5 s per case); the
deployed service uses native CPython and RapidFuzz's compiled implementation.

## What was fixed, and what found it

| Failure seen on dev | Fix | Commit |
|---|---|---|
| One added/replaced word still scored "matches source" (character similarity ≥ 92) | "matches" now requires a word-for-word match after normalization; honorifics ignored | `e296b4a` |
| Short sayings matched unrelated texts («النظافة من الإيمان» ↔ «البذاذة من الإيمان») | variant needs ≥ 3 shared words, ≥ 60% of the quote and ≥ 70% of the source window | `e296b4a` |
| «[طه: 70]» not parsed (2-letter surah names skipped) | short names accepted when followed by an ayah number; surah+ayah checked as a pair | `e296b4a` |
| «الإيمان يمان…» cited to Muslim accepted because Muslim has a different hadith with overlapping words | same window-share rule | `e296b4a` |
| Exact wording only in an-Nasa'i while the cited Sahihs differ was "matches source" (found on the user-test script) | wording judged against the cited collection, with a note | `f529217` |
| Hadith reciting a verse listed before the ayah and made Quran quotes "ambiguous" (found on the live database) | quotes presented as Quran are judged against the Quran when it matches | `a50c20f` |
| English quotes: wrong-reference verdicts from translation wording; English verse matched a hadith translation (found on the live API) | translated hadith → review, not mismatch; translated verse → compared with the Arabic ayah at the cited reference | `0004330` |
| `g-083`: hadith qudsi introduced with «قال تعالى» typed as hadith by the model, so "presented as Quran" was missed (live run with Claude) | explicit markers decide the presented type | `cb30407` |

## Remaining dev failure

- `g-009`: the generated excerpt ends with «… للنبي صلى», cut in the middle of «صلى الله عليه وسلم». The pipeline
  reports the dangling «صلى» as an added word. This is a gold-generation artifact (no writer ends a quote there); the
  gold set was not changed to avoid tuning on it.
