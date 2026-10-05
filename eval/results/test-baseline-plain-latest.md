# Eval test-baseline-plain (20261005-064329)

| metric | value |
|---|---|
| detection_recall | 1.0 |
| status_accuracy | 0.906 |
| false_support_rate | 0.0 |
| abstention_recall | 1.0 |
| reference_accuracy | 0.593 |
| review_recall | None |
| latency_p50_s | 4.8 |
| consistency_across_runs | 1.0 |
| cases | 28 |
| items | 32 |
| runs | 1 |
| llm_used | ['True'] |

## Failures in run 1 (11)

| id | category | quote | gold | got | gold ref | got ref |
|---|---|---|---|---|---|---|
| g-012 | hadith_exact | من قال حين يصبح اللهم إني أصبحت | matches_source | matches_source | سنن أبي داود 5078 | سنن أبي داود 5069 |
| g-014 | hadith_exact | ليس على المسلم صدقة في عبده ولا | matches_source | wording_differs | صحيح البخاري 1464 | صحيح البخاري 1463 |
| g-028 | hadith_altered | إنه قد شهد بدرا وما يدريك لعل الله اطلع على أهل بدر أبدا | wording_differs | wording_differs | صحيح مسلم 2494 | صحيح البخاري 3007 |
| g-029 | hadith_altered | إن مثل المنفق المتصدق والبخيل كمثل رجلين عليهما جبتان أو جنتان أبدا | wording_differs | wording_differs | سنن النسائي 2547 | صحيح البخاري 1443 |
| g-030 | hadith_altered | السراويل لمن دائما يجد الإزار والخفين لمن لا يجد النعلين | wording_differs | wording_differs | سنن النسائي 2671 | صحيح مسلم 1178 |
| g-048 | hadith_weak_graded | ما تؤتي الناس من المال والأهل والولد غير | matches_source | not_found | جامع الترمذي 3586 | None |
| g-049 | hadith_weak_graded | لأنا بهم أو ببعضهم أوثق مني بكم أو ببعضكم | matches_source | matches_source | جامع الترمذي 3932 | None |
| g-050 | hadith_weak_graded | إذا تجاحفت قريش على الملك فيما بينها وعاد العطاء أو كان | matches_source | wording_differs | سنن أبي داود 2959 | None |
| g-085 | hadith_as_quran | كان لكم يومان تلعبون فيهما وقد أبدلكم الله بهما | reference_mismatch | reference_mismatch | سنن النسائي 1556 | سنن أبي داود 1134 |
| g-095 | english | We slaughtered (naharna) a horse during the time of the Messenger of A | matches_source | matches_source | سنن النسائي 4421 | None |
| g-100 | script | إن مثل المنفق المتصدق والبخيل كمثل رجلين عليهما جبتان أو جنتان أبدا | wording_differs | wording_differs | سنن النسائي 2547 | صحيح البخاري 1443 |
