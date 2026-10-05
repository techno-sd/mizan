# Eval dev-llm (20261005-062911)

| metric | value |
|---|---|
| detection_recall | 1.0 |
| status_accuracy | 0.977 |
| false_support_rate | 0.024 |
| abstention_recall | 1.0 |
| reference_accuracy | 1.0 |
| review_recall | None |
| latency_p50_s | 1.327 |
| consistency_across_runs | 1.0 |
| cases | 72 |
| items | 88 |
| runs | 3 |
| llm_used | ['True'] |

## Failures in run 1 (2)

| id | category | quote | gold | got | gold ref | got ref |
|---|---|---|---|---|---|---|
| g-009 | hadith_exact | لم يأذن الله لشىء ما أذن للنبي صلى | matches_source | wording_differs | صحيح البخاري 5023 | صحيح البخاري 5023؛ صحيح البخاري 7482؛ صحيح البخاري 5024 |
| g-083 | hadith_as_quran | لما خلق الله الخلق كتب في كتابه هو يكتب على نفسه | reference_mismatch | matches_source | صحيح البخاري 7404 | صحيح البخاري 7404؛ صحيح مسلم 2751؛ الأحاديث القدسية 1 |
