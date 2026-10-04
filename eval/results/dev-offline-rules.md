# Offline eval: dev (rules-only, corpus 2026-10-04)

Cases: 72 · items: 88

| metric | value |
|---|---|
| detection_recall | 1.0 |
| status_accuracy | 0.989 |
| false_support_rate | 0.0 |
| abstention_recall | 1.0 |
| reference_accuracy | 1.0 |
| review_recall | None |
| latency_mean_s | 9.49 |
| llm | rules-only |

| category | status accuracy |
|---|---|
| hadith_exact | 0.909 |
| hadith_altered | 1.0 |
| hadith_wrong_collection | 1.0 |
| hadith_weak_graded | 1.0 |
| not_in_corpus | 1.0 |
| quran_correct | 1.0 |
| quran_wrong_ayah | 1.0 |
| hadith_as_quran | 1.0 |
| english | 1.0 |
| script | 1.0 |

## Failures (1)

| id | category | quote | gold | got | gold ref | got ref |
|---|---|---|---|---|---|---|
| g-009 | hadith_exact | لم يأذن الله لشىء ما أذن للنبي صلى | matches_source | wording_differs | صحيح البخاري 5023 | صحيح البخاري 5023؛ صحيح البخاري 7482؛ صحيح البخاري 5024 |
