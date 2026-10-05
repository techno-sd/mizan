# Popular claims: Mizan vs. a general AI model

Run on 2026-10-05. 37 short texts in [`eval/challenge.jsonl`](../challenge.jsonl), one quote each, of the kind
that circulates in Islam-introduction content. Same model everywhere (Claude Sonnet 5.5). The general model was also
asked for each hadith's grade (`run_baseline.mjs --grade`), as a user would ask a chatbot. Scored by
[`eval/score_challenge.mjs`](../score_challenge.mjs).

| | **Mizan** | Claude, directly |
|---|---|---|
| Fabricated / baseless / weak sayings **attributed to a source** (lower is better) | **0/13** | 0/13 |
| … of them **called authentic** (lower is better) | **0/13** | 0/13 |
| Authentic hadith cited to the wrong book: **caught, with the right book** | **8/8** | 8/8 |
| Verse issues (wrong surah/ayah, altered wording, hadith presented as a verse): **caught** | **8/8** | 7/8 |
| Correct quotes confirmed (no false alarm) | **8/8** | 8/8 |
| **Invented references** (a book or surah:ayah where the text is not) | **0** | 0 |
| Same result across 3 runs | **37/37** | not measured |

## Every case

| id | category | Mizan | Claude, directly |
|---|---|---|---|
| c-01 | no_basis | ✅ not_found | ✅ not_found · موضوع |
| c-02 | no_basis | ✅ not_found | ✅ not_found · لا أصل له |
| c-03 | no_basis | ✅ not_found | ✅ not_found · لا أصل له |
| c-04 | no_basis | ✅ not_found | ✅ not_found · موضوع |
| c-05 | no_basis | ✅ not_found | ✅ not_found · ضعيف |
| c-06 | no_basis | ✅ not_found | ✅ not_found · لا أصل له |
| c-07 | no_basis | ✅ not_found | ✅ not_found · لا أصل له |
| c-08 | no_basis | ✅ not_found | ✅ not_found · لا أصل له |
| c-09 | no_basis | ✅ not_found | ✅ not_found · ضعيف |
| c-10 | no_basis | ✅ not_found | ✅ not_found · لا أصل له |
| c-11 | no_basis | ✅ not_found | ✅ not_found · لا أصل له |
| c-12 | no_basis | ✅ not_found | ✅ not_found · ضعيف |
| c-13 | no_basis | ✅ not_found | ✅ not_found · لا أصل له |
| c-14 | wrong_book | ✅ reference_mismatch · سنن ابن ماجه 2225؛ صحيح مسلم 101؛ جامع الترمذي 1315 | ✅ reference_mismatch · صحيح مسلم 101 · صحيح |
| c-15 | wrong_book | ✅ reference_mismatch · رواه الترمذي (موسوعة الأحاديث النبوية، رقم 66237)؛ جامع الترمذي 1956 | ✅ reference_mismatch · جامع الترمذي 1956 · حسن |
| c-16 | wrong_book | ✅ reference_mismatch · رواه الدارقطني (موسوعة الأحاديث النبوية، رقم 4711)؛ رواه ابن ماجه، وال | ✅ reference_mismatch · سنن ابن ماجه 2340 · حسن |
| c-17 | wrong_book | ✅ reference_mismatch · رواه الترمذي (موسوعة الأحاديث النبوية، رقم 4302)؛ جامع الترمذي 1987 | ✅ reference_mismatch · جامع الترمذي 1987 · حسن |
| c-18 | wrong_book | ✅ reference_mismatch · جامع الترمذي 2501 | ✅ reference_mismatch · جامع الترمذي 2501 · صحيح |
| c-19 | wrong_book | ✅ reference_mismatch · الحديث الأول: رواه مسلم، والحديث الثاني: رواه أحمد والدارمي. (موسوعة ا | ✅ reference_mismatch · صحيح مسلم 2553 · صحيح |
| c-20 | wrong_book | ✅ reference_mismatch · رواه مسلم (موسوعة الأحاديث النبوية، رقم 6209)؛ جامع الترمذي 1999؛ صحيح | ✅ reference_mismatch · صحيح مسلم 91 · صحيح |
| c-21 | wrong_book | ✅ reference_mismatch · رواه مسلم (موسوعة الأحاديث النبوية، رقم 66526)؛ رواه مسلم (موسوعة الأح | ✅ reference_mismatch · صحيح مسلم 223 · صحيح |
| c-22 | quran_issue | ✅ wording_differs · الحجرات: 10 | ✅ wording_differs · الحجرات: 10 |
| c-23 | quran_issue | ✅ reference_mismatch · المائدة: 2 | ✅ reference_mismatch · المائدة: 2 |
| c-24 | quran_issue | ✅ reference_mismatch · غافر: 60 | ✅ reference_mismatch · غافر: 60 |
| c-25 | quran_issue | ✅ reference_mismatch · الشرح: 5 | ✅ reference_mismatch · الشرح: 5 |
| c-26 | quran_issue | ✅ reference_mismatch · متفق عليه (موسوعة الأحاديث النبوية، رقم 4560)؛ رواه إماما المحدثين أبو | ✅ reference_mismatch · صحيح البخاري 1 · صحيح |
| c-27 | quran_issue | ✅ reference_mismatch · الرعد: 11 | ✅ reference_mismatch · الرعد: 11 |
| c-28 | quran_issue | ✅ wording_differs · طه: 114 | ❌ matches_source · طه: 114 |
| c-29 | quran_issue | ✅ wording_differs · يوسف: 87 | ✅ wording_differs · يوسف: 87 |
| c-30 | control | ✅ matches_source · البقرة: 286 | ✅ matches_source · البقرة: 286 |
| c-31 | control | ✅ matches_source · آل عمران: 103 | ✅ matches_source · آل عمران: 103 |
| c-32 | control | ✅ matches_source · الذاريات: 56 | ✅ matches_source · الذاريات: 56 |
| c-33 | control | ✅ matches_source · متفق عليه (موسوعة الأحاديث النبوية، رقم 10101)؛ جامع الترمذي 2627؛ صحي | ✅ matches_source · صحيح البخاري 10 · صحيح |
| c-34 | control | ✅ matches_source · متفق عليه (موسوعة الأحاديث النبوية، رقم 5866)؛ صحيح البخاري 69؛ صحيح ا | ✅ matches_source · صحيح البخاري 69 · صحيح |
| c-35 | control | ✅ matches_source · رواه البخاري (موسوعة الأحاديث النبوية، رقم 5913)؛ جامع الترمذي 2907؛ ص | ✅ matches_source · صحيح البخاري 5027 · صحيح |
| c-36 | control | ✅ matches_source · صحيح البخاري 6540؛ صحيح مسلم 1016؛ سنن النسائي 2552؛ صحيح البخاري 6023 | ✅ matches_source · صحيح البخاري 1417 · صحيح |
| c-37 | control | ✅ matches_source · متفق عليه (موسوعة الأحاديث النبوية، رقم 5478)؛ جامع الترمذي 2615؛ سنن  | ✅ matches_source · صحيح البخاري 24 · صحيح |

## Reading these numbers

- **Labels.** Verdicts for the sayings come from the standard works on weak and fabricated hadith, and every
  location was checked against the hadith books themselves (see `basis` in each case). They are pending review by a
  specialist; a corrected label changes the numbers above, and the scorer can be re-run.
- **Mizan does not judge authenticity.** For a saying it cannot find it says «لم يُعثر عليه» and that this does not
  mean fabricated. The safe outcome counted here is "not attributed to a source", which is what a reviewer needs.
- **Small set** (37 texts). An indication, not a general claim.
