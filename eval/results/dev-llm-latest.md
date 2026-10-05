# Eval dev-llm (20261005-063422)

| metric | value |
|---|---|
| detection_recall | 1.0 |
| status_accuracy | 0.989 |
| false_support_rate | 0.0 |
| abstention_recall | 1.0 |
| reference_accuracy | 1.0 |
| review_recall | None |
| latency_p50_s | 0.647 |
| consistency_across_runs | 1.0 |
| cases | 72 |
| items | 88 |
| runs | 3 |
| llm_used | ['True'] |

## Failures in run 1 (1)

| id | category | quote | gold | got | gold ref | got ref |
|---|---|---|---|---|---|---|
| g-009 | hadith_exact | لم يأذن الله لشىء ما أذن للنبي صلى | matches_source | wording_differs | صحيح البخاري 5023 | صحيح البخاري 5023؛ صحيح البخاري 7482؛ صحيح البخاري 5024 |
