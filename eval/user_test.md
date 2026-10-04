# User test (Day 2)

Goal: does Mizan help people who introduce Islam find problems in a text faster and more reliably than checking by
hand? Rewarded by the judging criteria (UX 10%: "tests with the target group, and improvements made based on them").

## Participants

3–5 people from the target group (writers, editors or translators of Islam-introduction content). Record role and
experience only, no names.

## Material

[`user_test_script_ar.txt`](user_test_script_ar.txt): a realistic short text with **8 quotes, 5 of which need
attention**. Participants do not see the answer key.

| # | Quote (start) | Planted issue | Expected Mizan result |
|---|---|---|---|
| 1 | ادع إلى سبيل ربك بالحكمة… [النحل: 152] | wrong ayah number | الإحالة غير دقيقة → النحل: 125 |
| 2 | من قتل نفسا بغير نفس… [المائدة: 32] | none | مطابق للمصدر |
| 3 | ليس الشديد بالصرعة… (رواه البخاري) | none | مطابق للمصدر (البخاري 6114؛ ومسلم 2609) |
| 4 | إن الله لا ينظر إلى صوركم… (رواه البخاري) | wrong collection | الإحالة غير دقيقة → صحيح مسلم 2564 |
| 5 | اتق الله حيثما كنت… (رواه الترمذي) | none | مطابق للمصدر (الترمذي 1987) |
| 6 | لا يؤمن أحدكم… من الخير (متفق عليه) | added words vs the cited Sahihs | اللفظ مختلف؛ بهذا اللفظ عند النسائي 5017 |
| 7 | طلب العلم فريضة على كل مسلم (رواه ابن ماجه) | very weak gradings | مطابق للمصدر + شارة «ضُعِّف بشدة» (ابن ماجه 224) |
| 8 | حب الوطن من الإيمان | not in the loaded collections | لم يُعثر عليه (لا يعني أنه موضوع) |

Verified against the full corpus with `python -m scripts.demo ../../eval/user_test_script_ar.txt --corpus 2026-10-04`.

## Protocol (≈ 20 minutes per person)

1. **Manual** (10 min max): "Check this text before publishing. Mark every problem you find." Any web search allowed.
   Record issues found and time taken.
2. **With Mizan** (10 min max): same text in the live app, think aloud. Record issues found, time, and every moment
   of hesitation or confusion (quote their words).
3. Three questions:
   - Which result did you trust least, and why?
   - Was any label or color unclear?
   - Would you use this before publishing? What is missing?

Half the participants do step 2 before step 1, to limit learning effects.

## Observation sheet

| Participant | Role | Manual: found /5 | Manual: min | Mizan: found /5 | Mizan: min | Confusions (quotes) |
|---|---|---|---|---|---|---|
| P1 | | | | | | |
| P2 | | | | | | |
| P3 | | | | | | |

## Changes made from the findings

Fill in on Day 3: at least two changes, each with the observation that motivated it.

| Observation | Change | Commit |
|---|---|---|
| | | |
| | | |
