# Method

How Mizan decides each status, where AI is used, and where it is deliberately not used.

## 1. Normalization (`normalize.py`)

Used for search and comparison only; displayed text is always the original.

- remove harakat, Quranic annotation marks, superscript alef and tatweel;
- unify أ إ آ ٱ → ا, ى → ي, ة → ه, ؤ → و, ئ → ي; Arabic-Indic digits → ASCII;
- punctuation and symbols (including ﷺ, «», ﴿﴾) → space; lowercase Latin.

`normalize_with_map()` also returns, for every normalized character, its index in the original string, so a quote
found in normalized space can be highlighted precisely in the user's text.

## 2. Finding quotes (`extract.py`, `llm.py`)

- **Rules** catch explicit markers: ﴿…﴾; «قال تعالى / قال الله تعالى / يقول الله عز وجل»; «قال رسول الله ﷺ / قال النبي ﷺ /
  عن النبي ﷺ قال / قوله ﷺ»; "The Prophet (ﷺ) said". The quote is the quoted/bracketed string, or the rest of the
  sentence. A reference right after the quote ("(رواه البخاري)", "[البقرة: 255]") is captured.
- **Claude** (`EXTRACT_SYSTEM`, JSON schema) returns `quoted_text` copied verbatim, `type`, `attributed_to`,
  `cited_reference`. Each `quoted_text` must be found in the input (exact → normalized → fuzzy ≥ 90); otherwise it is
  dropped.
- Both lists are merged by span overlap; Claude's fields win, rules fill gaps.

## 3. Parsing the cited reference (`references.py`)

- `2:255`, `Quran 49:13` → surah/ayah.
- A surah name (all 114 names from Tanzil metadata, Arabic and transliterated) together with «سورة»/"surah" or
  followed by a number.
- Collection aliases (البخاري، صحيح مسلم، أبو داود، الترمذي، النسائي، ابن ماجه، الموطأ…, plus English). «متفق عليه» =
  al-Bukhari + Muslim. A bare «مسلم» counts only after a narration verb («رواه مسلم»).
- The first number is taken as the hadith number.

## 4. Matching (`align.py`)

For each candidate passage:

1. Choose the language: Arabic quote → `text_ar`; Latin quote → `text_en` when available.
2. Find the window of the passage that aligns with the quote (`rapidfuzz.partial_ratio_alignment`), then move its
   edges a few words either way to maximize similarity. This handles interjections such as
   «لأخيه - أو قال لجاره - ما يحب لنفسه».
3. `similarity = ratio(quote, window)`, so added and missing words both lower it.
4. Match type: `exact` (≥ T_exact and covers ≥ 90% of the passage), `partial` (≥ T_exact, an excerpt), `variant`
   (≥ T_variant), none otherwise.
5. Word diff (`difflib`) between the quote and the window: *insert* = only in the user's text; *delete* = only in the
   source.
6. `highlight` = character span of the window in the displayed source text.

Defaults: `T_exact = 92`, `T_variant = 75`. **Tune them on the dev split only.**

## 5. Grouping and ambiguity (`rules.py`)

- **Group:** the best match plus other passages whose aligned window carries the same wording (the same hadith via
  another chain, or in both Sahihs).
- **Ambiguous:** another passage with different wording scores within `ambiguity_margin` of the best → scholar review.

## 6. Status rules

| Status | Rule |
|---|---|
| `matches_source` | best similarity ≥ T_exact and no reference problem |
| `wording_differs` | T_variant ≤ best < T_exact |
| `reference_mismatch` | cited collection does not contain any acceptable match; or cited surah/ayah differs; or a hadith presented as Quran (or the reverse) |
| `not_found` | no candidate ≥ T_variant (after optional adjudication) |
| `out_of_scope` | general claims; attributed (non-prophetic) quotes not found in the hadith books |

A number-only difference inside the right collection is a **note**, not a mismatch: numbering differs between
editions.

## 7. Claude adjudication (only when matching found nothing)

The top 5 candidates are sent with the quote. The JSON schema restricts `passage_id` to those candidate ids (or 0).
The answer is used only if `supporting_excerpt` is found verbatim (after normalization) in the chosen passage;
otherwise the item stays `not_found` and is flagged for review. `same_text` (e.g. a faithful translation) counts as a
match; `same_meaning` as `wording_differs`. Both carry a note that the match was model-assisted.

## 8. Gradings

- Copied from the source data as `[{scholar, grade}]`; shown with the scholar's own wording (plus an Arabic rendering
  of known names and terms).
- `category` (accepted / weak / rejected / unknown) is a display hint from keywords; order matters ("very daif"
  before "daif").
- Accepted + weak/rejected gradings on the same text → scholar review.
- Gradings mentioning *mauquf*/*maqtu* on an item presented as hadith → note that the narration may be a Companion's
  or later saying.
- Texts in al-Bukhari or Muslim have no separate grading in the dataset; the UI states the collection.

## 9. What is never done

- No model writes a reference, a grading or a status.
- No status is inferred from the absence of evidence beyond "not found in the loaded corpus".
- No web search; no unloaded sources.
