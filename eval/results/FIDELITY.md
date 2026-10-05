# Word fidelity: Mizan vs. a general AI model

Run on 2026-10-05. 40 cases in [`eval/fidelity.jsonl`](../fidelity.jsonl), built by
[`eval/build_fidelity.mjs`](../build_fidelity.mjs): real ayat (QuranEnc) and hadith (HadeethEnc, cited with their approved
takhrij), half of them changed the way people misquote from memory: one particle or pronoun swapped (من/عن، في/على،
لكم/لهم), a near-synonym (يحب/يرضى، قال/يقول), or a small word dropped (قد، إن، هو). Every changed text occurs nowhere in
the corpus, so the right answer is objective. Same model everywhere (Claude Sonnet 5.5).

| | **Mizan** | Claude, directly |
|---|---|---|
| Verse changed by one word: **reported as differing** | **10/10** | 10/10 |
| Hadith changed by one word: **reported as differing** | **10/10** | 9/10 |
| Verse copied exactly: confirmed (no false alarm) | **10/10** | 9/10 |
| Hadith copied exactly: confirmed (no false alarm) | **10/10** | 3/10 |
| **All** | **40/40** | 31/40 |
| Same result across 3 runs | **40/40** | not measured |

## Every case

| id | category | change | Mizan | Claude, directly |
|---|---|---|---|---|
| f-01 | quran_exact |  | ✅ matches_source | ❌ wording_differs |
| f-02 | quran_exact |  | ✅ matches_source | ✅ matches_source |
| f-03 | quran_exact |  | ✅ matches_source | ✅ matches_source |
| f-04 | quran_exact |  | ✅ matches_source | ✅ matches_source |
| f-05 | quran_exact |  | ✅ matches_source | ✅ matches_source |
| f-06 | quran_exact |  | ✅ matches_source | ✅ matches_source |
| f-07 | quran_exact |  | ✅ matches_source | ✅ matches_source |
| f-08 | quran_exact |  | ✅ matches_source | ✅ matches_source |
| f-09 | quran_exact |  | ✅ matches_source | ✅ matches_source |
| f-10 | quran_exact |  | ✅ matches_source | ✅ matches_source |
| f-11 | quran_altered | «من» ← «عن» | ✅ wording_differs | ✅ wording_differs |
| f-12 | quran_altered | «من» ← «عن» | ✅ wording_differs | ✅ wording_differs |
| f-13 | quran_altered | «قال» ← «يقول» | ✅ wording_differs | ✅ wording_differs |
| f-14 | quran_altered | «عن» ← «من» | ✅ wording_differs | ✅ wording_differs |
| f-15 | quran_altered | حذف «هم» | ✅ wording_differs | ✅ wording_differs |
| f-16 | quran_altered | «لهم» ← «لكم» | ✅ wording_differs | ✅ wording_differs |
| f-17 | quran_altered | «إلى» ← «على» | ✅ wording_differs | ✅ wording_differs |
| f-18 | quran_altered | «من» ← «عن» | ✅ wording_differs | ✅ wording_differs |
| f-19 | quran_altered | حذف «إن» | ✅ wording_differs | ✅ wording_differs |
| f-20 | quran_altered | «لهم» ← «لكم» | ✅ wording_differs | ✅ wording_differs |
| f-21 | hadith_exact |  | ✅ matches_source | ❌ wording_differs |
| f-22 | hadith_exact |  | ✅ matches_source | ❌ wording_differs |
| f-23 | hadith_exact |  | ✅ matches_source | ✅ matches_source |
| f-24 | hadith_exact |  | ✅ matches_source | ✅ matches_source |
| f-25 | hadith_exact |  | ✅ matches_source | ❌ wording_differs |
| f-26 | hadith_exact |  | ✅ matches_source | ❌ wording_differs |
| f-27 | hadith_exact |  | ✅ matches_source | ✅ matches_source |
| f-28 | hadith_exact |  | ✅ matches_source | ❌ wording_differs |
| f-29 | hadith_exact |  | ✅ matches_source | ❌ wording_differs |
| f-30 | hadith_exact |  | ✅ matches_source | ❌ wording_differs |
| f-31 | hadith_altered | «قال» ← «يقول» | ✅ wording_differs | ✅ wording_differs |
| f-32 | hadith_altered | «من» ← «عن» | ✅ wording_differs | ✅ wording_differs |
| f-33 | hadith_altered | «من» ← «عن» | ✅ wording_differs | ✅ wording_differs |
| f-34 | hadith_altered | حذف «هو» | ✅ wording_differs | ✅ wording_differs |
| f-35 | hadith_altered | «في» ← «على» | ✅ wording_differs | ✅ wording_differs |
| f-36 | hadith_altered | حذف «إن» | ✅ wording_differs | ✅ wording_differs |
| f-37 | hadith_altered | «من» ← «عن» | ✅ wording_differs | ✅ wording_differs |
| f-38 | hadith_altered | حذف «لقد» | ✅ wording_differs | ❌ matches_source |
| f-39 | hadith_altered | «من» ← «عن» | ✅ wording_differs | ✅ wording_differs |
| f-40 | hadith_altered | «في» ← «على» | ✅ wording_differs | ✅ wording_differs |
