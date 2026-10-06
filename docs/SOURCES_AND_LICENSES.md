# Sources, tools and licenses

Mizan's **primary sources are the ones listed in the challenge's scientific reference package**
(«المرجعية والحزمة العلمية والبيانات», version 20/3/1448), and it follows the package's content levels and scientific standard.
One **supplementary** hadith source that is not in the package is also loaded. Every result built on it says so (see below).
The organisers confirmed on 2026-10-06 that sources outside the package may be used **provided the reference is
stated**, which is how Mizan presents every result from it.

## Content sources (corpus `2026-10-05.2`)

### Approved sources (from the package)

| Source | What we use | How it is used |
|---|---|---|
| **موسوعة القرآن الكريم — QuranEnc** (Society for Islamic Content Service in Languages), https://quranenc.com, API `quranenc.com/api/v1` | 6,236 ayat: Arabic text of the King Fahd Complex mushaf (`arabic_text`), and the approved English translation `english_saheeh` | Verses are matched against the mushaf text, shown verbatim with surah:ayah. English verse quotes are matched against the approved translation. |
| **موسوعة الأحاديث النبوية — HadeethEnc** (same society), https://hadeethenc.com, API `hadeethenc.com/api/v1` | 3,574 hadith in Arabic and English, each with its **source (التخريج)** and **ruling (الحكم)**, and the full takhrij references | Hadith are matched against the encyclopedia text. The reference shown is the encyclopedia's takhrij (e.g. «متفق عليه»), the ruling is the encyclopedia's ruling, and the full takhrij is one click away. |

### Approved translations of the meanings of the Quran (QuranEnc)

One translation per language, from QuranEnc (approved source), for verses quoted in translation: English
`english_saheeh`, French `french_rashid`, Spanish `spanish_garcia`, German `german_bubenheim`, Indonesian
`indonesian_affairs`, Turkish `turkish_rwwad`, Urdu `urdu_junagarhi` (6,236 ayat each, footnote markers removed).
Downloaded with `scripts/fetch_translations.mjs`, loaded into `quran_translations` with `scripts/load_translations.py`.
A quote that matches one word for word is reported with the translator's name; other translations of the same verse
are checked by meaning instead, with a review flag.

### Supplementary source (not in the package)

| Source | What we use | How it is used |
|---|---|---|
| **hadith-api** (fawazahmed0), https://github.com/fawazahmed0/hadith-api, Unlicense | Arabic text of the six books and the Muwatta (al-Bukhari 7,580, Muslim 7,360, Abu Dawud 5,272, at-Tirmidhi 3,924, an-Nasa'i 5,679, Ibn Majah 4,338, Malik 1,829), with that dataset's numbering and the gradings it records | Lets Mizan find hadith that HadeethEnc does not hold (including weak ones), and check a cited book directly. Each evidence block and each ruling from it is labelled «المصدر: مجموعة hadith-api — مصدر إضافي غير مدرج في الحزمة العلمية». When the same text is in HadeethEnc, the approved record is shown first and its takhrij is the suggested reference. |

Package rules applied:

- «لا ينسب حديث دون مصدر وحكم معتمد في البيانات»: Mizan never attributes or grades a hadith itself. Every
  reference and ruling it shows is quoted from a named source: HadeethEnc's takhrij and ruling when the text is
  there, otherwise the supplementary source's book, number and recorded gradings, labelled as not in the package.
  A text found in neither is reported as «لم يُعثر عليه», which does not mean fabricated.
- «أهمية التأكد من موثوقية نقل الآيات»: verses are compared word by word with the mushaf text and the surah:ayah
  is checked.
- Not used: Tanzil (the Quran text comes only from QuranEnc).
- The API response carries the source on every item (`evidence[].source_id`, `source_label`, `source_url`,
  `source_approved`; `gradings[].source_label`, `source_approved`), so other clients can show it too.

Download URLs and SHA-256 checksums are recorded in the corpus manifest
(`services/api/data/corpus/<version>/manifest.json`) and in the `corpus_versions` table.

### Content levels («مستويات المحتوى وضبط الاستجابة»)

| Level | Example | Mizan's behaviour |
|---|---|---|
| (أ) معلومات أصلية مستقرة | a verse, an authentic hadith | direct answer documented with the source: text, reference, ruling, link |
| (ب) شرح وتعريف واستدلال | — | not generated; Mizan does not explain or argue |
| (ج) مسائل خلافية أو عالية الحساسية | differing rulings, ambiguous matches | flagged «يُحال لمختص» |
| (د) فتوى أو حالة شخصية | — | out of scope; Mizan gives no rulings on cases |

### Known data characteristics

- HadeethEnc contains authentic and good hadith only (ruling «صحيح» 3,205, «حسن» 275, others «حسن لغيره»,
  «صحيح لغيره»…). Weak texts are found only in the supplementary source, with the gradings it records.
- Some HadeethEnc records are the same hadith in two places (e.g. once in a topic and once in the forty Nawawi);
  both are kept.

## Software

| Component | License |
|---|---|
| Next.js, React | MIT |
| Tailwind CSS | MIT |
| FastAPI, Starlette | MIT / BSD-3 |
| Pydantic, pydantic-settings | MIT |
| RapidFuzz | MIT |
| psycopg, psycopg-pool | LGPL-3.0 (used unmodified as a library) |
| Anthropic Python SDK | MIT |
| Uvicorn | BSD-3 |
| Fonts: IBM Plex Sans Arabic, Amiri | SIL Open Font License 1.1 |

## Services

| Service | Use |
|---|---|
| Anthropic Claude API (`claude-sonnet-5-5`) | quote extraction; adjudication of unclear matches |
| Supabase (Postgres, pg_trgm, pgvector) | corpus, search, cache, run log |
| Vercel | web app hosting |
| Render | API hosting |
