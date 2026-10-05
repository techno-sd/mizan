# Sources, tools and licenses

Mizan uses **only sources listed in the challenge's scientific reference package**
(«المرجعية والحزمة العلمية والبيانات», version 20/3/1448), and follows its content levels and its scientific standard.

## Content sources (corpus `2026-10-05`)

| Source (from the package) | What we use | How it is used |
|---|---|---|
| **موسوعة القرآن الكريم — QuranEnc** (Society for Islamic Content Service in Languages), https://quranenc.com, API `quranenc.com/api/v1` | 6,236 ayat: Arabic text of the King Fahd Complex mushaf (`arabic_text`), and the approved English translation `english_saheeh` | Verses are matched against the mushaf text, shown verbatim with surah:ayah. English verse quotes are matched against the approved translation. |
| **موسوعة الأحاديث النبوية — HadeethEnc** (same society), https://hadeethenc.com, API `hadeethenc.com/api/v1` | 3,574 hadith in Arabic and English, each with its **source (التخريج)** and **ruling (الحكم)**, and the full takhrij references | Hadith are matched against the encyclopedia text. The reference shown is the encyclopedia's takhrij (e.g. «متفق عليه»), the ruling is the encyclopedia's ruling, and the full takhrij is one click away. |

Package rules applied:

- «لا ينسب حديث دون مصدر وحكم معتمد في البيانات»: every hadith Mizan shows comes from HadeethEnc with its takhrij
  and ruling. A hadith not in the approved data is reported as «لم يُعثر عليه في المصادر المعتمدة», never
  attributed or graded by Mizan.
- «أهمية التأكد من موثوقية نقل الآيات»: verses are compared word by word with the mushaf text and the surah:ayah
  is checked.
- Not used: any source outside the package (the earlier Tanzil and hadith-api data were removed on 2026-10-05).

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
  «صحيح لغيره»…). Weak or fabricated texts are therefore reported as not found in the approved sources.
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
