# Offline eval: dev (rules-only, corpus 2026-10-04)

Cases: 72 · items: 88

| metric | value |
|---|---|
| detection_recall | 1.0 |
| status_accuracy | 0.841 |
| false_support_rate | 0.18 |
| abstention_recall | 0.5 |
| reference_accuracy | 1.0 |
| review_recall | None |
| latency_mean_s | 9.68 |
| llm | rules-only |

| category | status accuracy |
|---|---|
| hadith_exact | 1.0 |
| hadith_altered | 0.545 |
| hadith_wrong_collection | 0.857 |
| hadith_weak_graded | 1.0 |
| not_in_corpus | 0.571 |
| quran_correct | 1.0 |
| quran_wrong_ayah | 0.857 |
| hadith_as_quran | 1.0 |
| english | 1.0 |
| script | 0.8 |

## Failures (14)

| id | category | quote | gold | got | gold ref | got ref |
|---|---|---|---|---|---|---|
| g-017 | hadith_altered | ما من أحد يدان دائما فعلم الله أنه | wording_differs | matches_source | سنن النسائي 4686 | سنن النسائي 4686 |
| g-020 | hadith_altered | من أتم الوضوء كما أمره الله عز وجل فالصلوات الخمس كفارات أبدا | wording_differs | matches_source | سنن النسائي 145 | سنن النسائي 145؛ صحيح مسلم 231؛ سنن ابن ماجه 459 |
| g-021 | hadith_altered | الزمان وينقص العلم ويلقى الشح وتظهر الفتن ويكثر من الخير | wording_differs | matches_source | سنن ابن ماجه 4052 | سنن ابن ماجه 4052؛ صحيح البخاري 7061 |
| g-022 | hadith_altered | الزرع تفيئها الريح الصادق وتعدلها مرة، ومثل المنافق كالأرزة لا تزال | wording_differs | matches_source | صحيح البخاري 5643 | صحيح البخاري 5643 |
| g-024 | hadith_altered | أتاكم رمضان شهر مبارك دائما الله عز وجل عليكم صيامه تفتح فيه | wording_differs | matches_source | سنن النسائي 2106 | سنن النسائي 2106 |
| g-037 | hadith_wrong_collection | الإيمان يمان، والفتنة ها هنا، ها هنا يطلع قرن | reference_mismatch | matches_source | صحيح البخاري 4389 | صحيح البخاري 4389؛ صحيح مسلم 2905 |
| g-051 | not_in_corpus | النظافة من الإيمان | not_found | wording_differs | None | سنن أبي داود 4161 |
| g-052 | not_in_corpus | حب الوطن من الإيمان | not_found | reference_mismatch | None | الحجرات: 7 |
| g-054 | not_in_corpus | الدين المعاملة | not_found | wording_differs | None | صحيح البخاري 3116؛ البقرة: 193؛ صحيح البخاري 43 |
| g-071 | quran_wrong_ayah | قالوا يا موسى إما أن تلقي وإما أن نكون أول من ألقى | reference_mismatch | matches_source | طه: 65 | طه: 65؛ الأعراف: 115 |
| g-096 | script | خير الأمور أوسطها | not_found | wording_differs | None | سنن ابن ماجه 45 |
| g-096 | script | من أتم الوضوء كما أمره الله عز وجل فالصلوات الخمس كفارات أبدا | wording_differs | matches_source | سنن النسائي 145 | سنن النسائي 145؛ صحيح مسلم 231؛ سنن ابن ماجه 459 |
| g-097 | script | السراويل لمن دائما يجد الإزار والخفين لمن لا يجد النعلين | wording_differs | matches_source | سنن النسائي 2671 | سنن النسائي 2671؛ سنن أبي داود 1829؛ صحيح مسلم 1178 |
| g-097 | script | النظافة من الإيمان | not_found | wording_differs | None | سنن أبي داود 4161 |
