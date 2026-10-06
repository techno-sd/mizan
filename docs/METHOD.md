# Method

How Mizan decides each status, where AI is used, and where it is deliberately not used.

## 1. Normalization (`normalize.py`)

Used for search and comparison only; displayed text is always the original.

- remove harakat, Quranic annotation marks, superscript alef and tatweel;
- unify أ إ آ ٱ → ا, ى → ي, ة → ه, ؤ → و, ئ → ي; Arabic-Indic digits → ASCII;
- punctuation and symbols (including ﷺ, «», ﴿﴾) → space; lowercase Latin.

`normalize_with_map()` also returns, for every normalized character, its index in the original string, so a quote
found in normalized space can be highlighted precisely in the user's text.

API spans use Unicode code points. The web app converts these to UTF-16 offsets before highlighting or editing,
including source-passage highlights, so emojis do not shift a quote or corrupt its replacement.

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
- A surah name (all 114, Arabic and transliterated, from `app/data/surahs.json`) together with «سورة»/"surah" or
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
4. Match type: `exact` (word-for-word after supported normalization, covers ≥ 90% of the passage), `partial`
   (word-for-word excerpt), or `variant` (≥ T_variant and enough shared words). Similarity alone cannot confirm text.
   Quran spelling equivalents come from the source token's actual vowel marks and its stripped spelling. Ordinary
   alefs are preserved: «قال» never becomes identical to «قل».
5. Word diff (`difflib`) between the quote and the window: *insert* = only in the user's text; *delete* = only in the
   source.
6. `highlight` = character span of the window in the displayed source text.

Defaults: `T_exact = 92`, `T_variant = 75`. **Tune them on the dev split only.**

## 5. Grouping and ambiguity (`rules.py`)

- **Group:** the best match plus other passages whose aligned window carries the same wording (the same hadith via
  another chain, or in both Sahihs).
- **Ambiguous:** another passage with different wording scores within `ambiguity_margin` of the best → scholar review.
- **Order of equally good matches:** the approved source (HadeethEnc) first, then al-Bukhari and Muslim, then the
  Sunan. A quote may drop a joining «و» or «ف» at its start and still match word for word.

## 6. Status rules

| Status | Rule |
|---|---|
| `matches_source` | word-for-word match and no reference problem; or model-assisted `same_text`, visibly labelled and requiring review |
| `wording_differs` | accepted variant with a word difference, or model-assisted `same_meaning` |
| `reference_mismatch` | cited collection does not contain any acceptable match; or cited surah/ayah differs; or a hadith presented as Quran (or the reverse) |
| `not_found` | no candidate ≥ T_variant (after optional adjudication) |
| `out_of_scope` | general claims; attributed (non-prophetic) quotes not found in the hadith books |

A number-only difference inside the right collection is a **note**, not a mismatch: numbering differs between
editions.

## 7. Verses quoted in translation

A verse written in another language is detected by `language.py` (Urdu by its own letters, Latin-script languages by
common words). It is compared **word for word with QuranEnc's approved translation in that language**
(`quran_translations`; the cited ayah first, then the ayat search finds). A match is certain and names the translator;
a wrong ayah number is reported. Another translator's wording is not an error: it falls through to the meaning check in
section 9. Without the translation table the API logs a warning and uses the meaning check directly.

## 8. When matching finds nothing: Claude proposes, the database confirms

Search is lexical, so a paraphrase, another English translation or a misremembered wording can share too few words
with its source to be retrieved. Claude is then asked where the text comes from (`LOCATE_SYSTEM`): up to 5
locations (collection + hadith number, or surah + ayah) and the source wording in Arabic. This is a **search hint
only**:

- each location is looked up in the corpus by number; the recalled Arabic wording is run as a second search query;
- the passages found are compared with the **user's** quote by the same deterministic matcher, so an exact match
  found this way is a plain match with no model judgment;
- otherwise they go first into adjudication (below). Nothing Claude wrote in this step is ever shown.

A verse quoted in translation is checked against the Arabic ayah at the cited reference together with the ayat
Claude proposes, in one adjudication. A verified ayah other than the cited one is a `reference_mismatch`; the
neighbouring ayah (translations often span two) is flagged for review instead.

## 9. Claude adjudication (only when matching found nothing)

Up to 6 candidates are sent with the quote (Claude's proposals first). The JSON schema restricts `passage_id` to those
candidate ids (or 0). The answer is used only if `supporting_excerpt` is found in the chosen passage as whole words
(after normalization) and is at least 3 words long (or the whole passage), so a stock phrase such as «قال» cannot
verify a match; otherwise the item stays `not_found` and is flagged for review. A different statement on a related
theme («النظافة من الإيمان» vs «الطهور شطر الإيمان») must be judged `different`. `same_text` (e.g. a faithful translation) counts as a
match; `same_meaning` as `wording_differs`. Both are visibly labelled as model-assisted and require specialist review.
The excerpt check establishes that the cited words exist; it does not independently prove semantic equivalence.
The proposed-copy feature leaves all semantic or specialist-review findings unchanged and adds a review note.

## 10. Gradings

- Copied from the source data as `[{scholar, grade}]`; shown with the scholar's own wording (plus an Arabic rendering
  of known names and terms).
- `category` (accepted / weak / rejected / unknown) is a display hint from keywords; order matters ("very daif"
  before "daif").
- Accepted + weak/rejected gradings on the same text → scholar review.
- Gradings mentioning *mauquf*/*maqtu* on an item presented as hadith → note that the narration may be a Companion's
  or later saying.
- Texts in al-Bukhari or Muslim have no separate grading in the dataset; the UI states the collection.

## 11. What is never done

- No model freely generates a displayed reference or grading. Status rules are deterministic, but a semantic
  fallback uses the model's constrained equivalence decision and is always flagged for review.
- No status is inferred from the absence of evidence beyond "not found in the loaded corpus".
- No web search; no unloaded sources.
