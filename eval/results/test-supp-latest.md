# Eval test-supp (20261005-173712)

| metric | value |
|---|---|
| detection_recall | 1.0 |
| status_accuracy | 0.97 |
| false_support_rate | 0.0 |
| abstention_recall | 1.0 |
| reference_accuracy | 1.0 |
| review_recall | None |
| latency_p50_s | 1.54 |
| consistency_across_runs | 1.0 |
| cases | 29 |
| items | 33 |
| runs | 3 |
| llm_used | ['True'] |

## Failures in run 1 (1)

| id | category | quote | gold | got | gold ref | got ref |
|---|---|---|---|---|---|---|
| g-050 | hadith_sunan | وسلم يصلي، وفي صدره أزيز كأزيز الرحى | matches_source | wording_differs | رواه أبو داود والنسائي وأحمد (موسوعة الأحاديث النبوية، رقم 10653) | رواه أبو داود والنسائي وأحمد (موسوعة الأحاديث النبوية، رقم 10653)؛ سنن أبي داود 904 |
