# Eval test-baseline-plain (20261005-092327)

| metric | value |
|---|---|
| detection_recall | 1.0 |
| status_accuracy | 0.848 |
| false_support_rate | 0.0 |
| abstention_recall | 1.0 |
| reference_accuracy | 0.259 |
| review_recall | None |
| latency_p50_s | 3.75 |
| consistency_across_runs | 1.0 |
| cases | 29 |
| items | 33 |
| runs | 1 |
| llm_used | ['True'] |

## Failures in run 1 (21)

| id | category | quote | gold | got | gold ref | got ref |
|---|---|---|---|---|---|---|
| g-012 | hadith_exact | إنكم لتعملون أعمالا هي أدق في أعينكم | matches_source | matches_source | رواه البخاري (موسوعة الأحاديث النبوية، رقم 3300) | صحيح البخاري 6492 |
| g-013 | hadith_exact | إسباغ الوضوء على المكاره، وكثرة الخطا إلى المساجد، وانتظار الصلاة | matches_source | matches_source | رواه مسلم (موسوعة الأحاديث النبوية، رقم 3574) | صحيح مسلم 251 |
| g-014 | hadith_exact | وكان رسول الله قد أعطي جوامع الكلم بخواتمه | matches_source | reference_mismatch | رواه البخاري ومسلم (موسوعة الأحاديث النبوية، رقم 66536) | None |
| g-015 | hadith_exact | لسرني أن لا تمر علي ثلاث ليال وعندي | matches_source | matches_source | متفق عليه واللفظ للبخاري (موسوعة الأحاديث النبوية، رقم 3850) | صحيح البخاري 7228 |
| g-027 | hadith_altered | لا تعلموا العلم لتباهوا الصادق العلماء، ولا لتماروا به السفهاء، ولا | wording_differs | wording_differs | رواه ابن ماجه (موسوعة الأحاديث النبوية، رقم 65047) | سنن ابن ماجه 254 |
| g-028 | hadith_altered | أصابك شيء، فلا تقل حقا أني فعلت كان كذا وكذا، ولكن قل | wording_differs | wording_differs | رواه مسلم (موسوعة الأحاديث النبوية، رقم 5493) | صحيح مسلم 2664 |
| g-029 | hadith_altered | فإذا فتحتموها فأحسنوا إلى أهلها، فإن لهم إن شاء الله | wording_differs | wording_differs | رواه مسلم (موسوعة الأحاديث النبوية، رقم 65864) | صحيح مسلم 2543 |
| g-030 | hadith_altered | أن النبي صلى الله عليه الصادق كان يصلي ركعتين خفيفتين بعد ما | wording_differs | wording_differs | رواه البخاري (موسوعة الأحاديث النبوية، رقم 11248) | صحيح مسلم 723 |
| g-038 | hadith_wrong_collection | إذا لقيته فسلم عليه، وإذا دعاك فأجبه | reference_mismatch | reference_mismatch | رواه مسلم (موسوعة الأحاديث النبوية، رقم 5343) | صحيح مسلم 2162 |
| g-039 | hadith_wrong_collection | من قام من مجلسه، ثم رجع إليه فهو أحق به | reference_mismatch | reference_mismatch | رواه مسلم (موسوعة الأحاديث النبوية، رقم 66242) | صحيح مسلم 2179 |
| g-040 | hadith_wrong_collection | لقد هممت أن أنهى عن الغيلة، فنظرت في الروم وفارس، فإذا | reference_mismatch | reference_mismatch | رواه مسلم (موسوعة الأحاديث النبوية، رقم 58100) | صحيح مسلم 1442 |
| g-048 | hadith_sunan | من وقاه الله شر ما بين لحييه، وشر ما بين رجليه | matches_source | matches_source | رواه الترمذي (موسوعة الأحاديث النبوية، رقم 3477) | جامع الترمذي 2409 |
| g-049 | hadith_sunan | إن الشيطان قال: وعزتك يا رب، لا أبرح أغوي | matches_source | matches_source | رواه الإمام أحمد (موسوعة الأحاديث النبوية، رقم 8305) | مسند أحمد 11237 |
| g-050 | hadith_sunan | وسلم يصلي، وفي صدره أزيز كأزيز الرحى | matches_source | wording_differs | رواه أبو داود والنسائي وأحمد (موسوعة الأحاديث النبوية، رقم 10653) | سنن أبي داود 904 |
| g-068 | quran_correct | قل ٱلحمد لله وسلم على عباده ٱلذين ٱصطفى ءالله خير أما يشركون | matches_source | wording_differs | النمل: 59 | النمل: 59 |
| g-085 | hadith_as_quran | اسمعوا وأطيعوا، فإنما عليهم ما حملوا، وعليكم ما حملتم | reference_mismatch | reference_mismatch | رواه مسلم (موسوعة الأحاديث النبوية، رقم 5037) | صحيح مسلم 1846 |
| g-093 | english | When any of you is putting on his shoes, let him start | matches_source | wording_differs | متفق عليه (موسوعة الأحاديث النبوية، رقم 5357) | صحيح البخاري 5855 |
| g-094 | english | Practice archery, O progeny of Isma‘īl; your forefather was an archer | matches_source | matches_source | رواه البخاري (موسوعة الأحاديث النبوية، رقم 3559) | صحيح البخاري 2899 |
| g-095 | english | May Allah curse the Muhallil and the Muhallal lahu | matches_source | wording_differs | رواه أبو داود والترمذي وابن ماجه وأحمد (موسوعة الأحاديث النبوية، رقم 58076) | سنن أبي داود 2076 |
| g-105 | script | ما أظن فلانا وفلانا يعرفان من ديننا شيئا | reference_mismatch | reference_mismatch | رواه البخاري (موسوعة الأحاديث النبوية، رقم 3866) | صحيح البخاري 6067 |
| g-105 | script | أجملوا في طلب الدنيا، فإن كلا ميسر لما خلق له | matches_source | matches_source | رواه ابن ماجه (موسوعة الأحاديث النبوية، رقم 66148) | سنن ابن ماجه 2142 |
