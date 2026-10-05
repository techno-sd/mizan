# Sources, tools and licenses

## Content sources (corpus `2026-10-04`)

| Source | What we use | License / terms | How we comply |
|---|---|---|---|
| **Tanzil Project**, Quran text (Simple), https://tanzil.net | 6,236 ayat, verbatim; surah names from `quran-data.xml` | Verbatim copies allowed; changing the text is not allowed; the source must be indicated with a link to tanzil.net; the copyright notice must be kept in verbatim copies | Text stored and displayed verbatim; normalized copies are used only internally for search and never displayed; attribution and link in the app footer, the fixture file and this page |
| **fawazahmed0/hadith-api**, https://github.com/fawazahmed0/hadith-api | Arabic and English editions of al-Bukhari, Muslim, Abu Dawud, at-Tirmidhi, an-Nasa'i, Ibn Majah, Malik's Muwatta, 40 Nawawi, 40 Qudsi (36,064 hadith with Arabic text); gradings by named scholars where provided | Unlicense (public domain dedication) | Attribution in the app footer and here; gradings shown as provided, attributed to their scholars |

Download URLs and SHA-256 checksums of every file are recorded in the corpus manifest
(`services/api/data/corpus/<version>/manifest.json`) and in the `corpus_versions` table.

### Known data characteristics

- Muslim: the dataset's `arabicnumber` is used as the hadith number (e.g. 223, or 55.01 for sub-numbers);
  `hadithnumber` is kept in `extra`.
- 26 al-Bukhari and 42 at-Tirmidhi entries have fractional numbers; the integer part is stored as `number` and the
  exact label as `number_label`.
- Entries with empty Arabic text are skipped (e.g. 203 in Muslim).
- al-Bukhari, Muslim, 40 Nawawi and 40 Qudsi carry no gradings in the dataset.

### Not used (and why)

- Quran translations: licensing varies by translation; not included in this version.
- Open web pages: not treated as sources.

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
