# Eval dev-approved (20261005-091605)

| metric | value |
|---|---|
| detection_recall | 1.0 |
| status_accuracy | 0.989 |
| false_support_rate | 0.0 |
| abstention_recall | 1.0 |
| reference_accuracy | 1.0 |
| review_recall | None |
| latency_p50_s | 1.63 |
| consistency_across_runs | 1.0 |
| cases | 76 |
| items | 92 |
| runs | 3 |
| llm_used | ['True'] |

## Failures in run 1 (1)

| id | category | quote | gold | got | gold ref | got ref |
|---|---|---|---|---|---|---|
| g-067 | quran_correct | فما أوتيتم من شيء فمتع ٱلحيوة ٱلدنيا وما عند ٱلله خير وأبقى للذين ءامن | matches_source | wording_differs | الشورى: 36 | الشورى: 36 |
