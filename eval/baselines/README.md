# Baselines

Goal: a fair comparison on the **same test cases**, scored the same way.

## Systems

1. **General model, no tools**: Claude or ChatGPT in its standard chat interface, web search off.
2. **General model, web search on**: the same prompt. This is the fair comparison.
3. **Manual**: a reviewer with ordinary web search (record the time per script).

## Prompt (use verbatim)

```
راجع النص التالي قبل نشره. لكل آية أو حديث أو قول منسوب فيه:
1) هل النص موجود بلفظه في المصادر؟ إن اختلف اللفظ فاذكر الفرق.
2) هل الإحالة المذكورة صحيحة؟ إن لم تكن فاذكر الإحالة الصحيحة (السورة والآية، أو الكتاب ورقم الحديث).
3) إن كان حديثًا، فاذكر أحكام العلماء عليه ومن قالها.
إن لم تجد النص في المصادر فقل ذلك صراحة.

النص:
<<<
[paste the case text]
>>>
```

## Scoring (`scoring_template.csv`)

Per expected item:

| Column | Meaning |
|---|---|
| `found` | the item was addressed at all (1/0) |
| `status_correct` | the conclusion matches the gold status (1/0) |
| `reference_correct` | the reference given equals the gold reference (1/0/NA) |
| `fabricated_reference` | a reference that does not exist or does not contain the text (1/0) |
| `false_support` | said the text exists / is correct when gold says otherwise (1/0) |
| `notes` | free text |

Record the date, the model name and whether search was on. State the limits when reporting: small n, our case
selection, prompt sensitivity.
