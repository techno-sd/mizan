# ميزان | Mizan

**ميزان يفحص الآيات والأحاديث والأقوال المنسوبة في محتواك قبل النشر، ويريك النص كما ورد في مصدره، أو يخبرك بصراحة أنه لم يجده.**

*Mizan checks the verses, hadith and attributed quotes in your content against their sources before you publish, and
tells you honestly when it cannot find one.*

Built for the AI Challenge: Serving Islamic Content 2026, Track 04 (knowledge and verification tools for those who
introduce Islam), 4–6 October 2026.

- **Live demo:** https://mizan-islam.vercel.app · API health: https://mizan-api-dslz.onrender.com/health
- **Taking over the project? Read [HANDOVER.md](HANDOVER.md) first** (state, accounts, configuration, open items).

## نظرة سريعة

ألصق مقالًا أو منشورًا أو لقطة شاشة، فيستخرج ميزان كل آية وحديث وقول منسوب، ويقارنه حرفيًا بالمصادر المعتمدة في
الحزمة العلمية للتحدي (موسوعة القرآن الكريم QuranEnc، وموسوعة الأحاديث النبوية HadeethEnc)، ثم بمصدر إضافي يُذكر
مرجعه صراحةً (hadith-api: الكتب الستة وموطأ مالك). لكل اقتباس نتيجة واضحة: **مطابق للمصدر**، أو **يحتاج تصحيحًا**
مع الفرق كلمةً كلمة والمرجع الصحيح، أو **لم نجده في المصادر**. ويعرض حكم العلماء منسوبًا إلى كتابه، ونسخة مصححة
جاهزة للنشر، وتقريرًا قابلًا للتنزيل. ميزان لا يحكم بصحة الحديث بدلًا من العلماء، ولا يخترع مرجعًا.

## Try it in one minute

1. Open https://mizan-islam.vercel.app.
2. Pick the example «منشور دعوي». It contains a verse cited to the wrong number, a hadith cited to the wrong book, a
   hadith with an added word, a weak hadith and a saying with no source.
3. Press «افحص». Each quote gets a verdict, the exact wording difference, the correct reference with a copy button,
   and the source passage.
4. Open «نسخة مصححة» for the corrected text, or download the report. You can also paste or drop a screenshot.

## Results

| Test | Mizan | Same model (Claude Sonnet 5.5) used directly |
|---|---|---|
| Held-out gold set, 33 quotes: correct status | **32/33**, no false "matches the source" | 28/33 (29/33 with web search) |
| Held-out gold set: correct reference | **27/27** | 25/27 |
| Word fidelity: 40 texts, half changed by one word | **40/40** | 31/40, flagged 7 of 10 correctly quoted hadith as altered |
| Popular claims: 37 baseless sayings and misattributions | **37/37**, no invented references | 36/37 |

These are small sets, mostly generated from Mizan's own corpus, measured on 2026-10-05: an indication, not a general
accuracy claim. References are never invented by construction, because they come from the database. Method, limits and
how to reproduce: [docs/EVALUATION.md](docs/EVALUATION.md).

## What it does

Paste an article, post or script, or drop a screenshot of one. Mizan:

1. **finds** every Quran verse, hadith and attributed quote (rules plus Claude), and the reference the author cited;
2. **compares** each one word for word with a declared corpus: the challenge's approved sources first (QuranEnc, the
   King Fahd mushaf text; HadeethEnc, with its takhrij and ruling), then one labelled supplementary source (hadith-api:
   the six books and the Muwatta). Every result names its source;
3. **says what is wrong**: wrong reference, changed wording (shown word by word), or not found. It shows the source
   passage in context and the scholars' rulings as reported, with their names;
4. **offers a corrected copy** built only from the sources, with a per-change include/exclude choice and a
   downloadable review report;
5. **abstains**: "not found in the loaded sources" (never "fabricated"), and flags conflicting rulings or ambiguous
   matches for a specialist.

Verses quoted in translation (English, French, Spanish, German, Indonesian, Turkish, Urdu) are meant to be compared
word for word with QuranEnc's approved translation in that language. **The code is deployed, but the translation data
is not loaded into the live database yet**; until it is, translated verses go through the meaning check with a review
flag ([HANDOVER.md §5.1](HANDOVER.md)). Readers can report a wrong result from each finding.

Two axes are kept apart on purpose: the **reference** (Mizan decides, by deterministic rules) and the **rulings**
(scholars decide; Mizan only reports). "Matches the source" means the text exists, not that it is authentic.

## Where the AI is, and is not

Claude (Sonnet 5.5) does four narrow jobs, each with JSON-schema output: finding quotes in free text, suggesting where
a quote might come from when search finds nothing, judging an unclear match among real candidates, and transcribing a
screenshot. **Nothing it writes is shown without a check**: a quote it extracts must exist in the user's text, a place
it suggests is looked up in the database and compared by the same rules as any candidate, and a match it judges counts
only if the excerpt it cites is found in the source. No model writes a reference, a ruling or a status.
See [docs/METHOD.md](docs/METHOD.md).

## Status

| Built and live | Proposed, not built |
|---|---|
| Verification pipeline with five statuses and a specialist flag; web app (Arabic, RTL, light/dark, mobile); `POST /v1/verify`, `/v1/image-text`, `/v1/feedback` | Quran translations in the live database (code deployed, data not loaded); hadith translations (HadeethEnc); more languages |
| Corpus `2026-10-05.2`: 45,792 passages (6,236 ayat, 3,574 approved hadith, 35,982 supplementary hadith) | Embeddings for meaning-level matching |
| Suggested corrected copy, review report, screenshot check, "report a wrong result" queue | Specialist screen for the feedback queue; durable audit trail |
| Evaluation sets and a comparison with the same model used directly ([docs/EVALUATION.md](docs/EVALUATION.md)) | Shared rate limit and spending cap; organization workspaces; browser/editor add-ons; Telegram/WhatsApp bot |

**Not yet done:** target-user test and specialist review ([eval/user_test.md](eval/user_test.md),
[eval/specialist_review.md](eval/specialist_review.md)).

## Repository

```
apps/web/         Next.js app: UI and server-side proxies to the API
services/api/     FastAPI verification service (Python 3.12)
db/migrations/    Postgres schema and search functions
eval/             evaluation sets, scorers, baselines, saved results
docs/             architecture, method, evaluation, sources, limits, operations, idea
HANDOVER.md       state, accounts, configuration, open items
```

## Run locally

```bash
# API (Python 3.12)
cd services/api
pip install -e ".[dev]"
cp .env.example .env            # optional: ANTHROPIC_API_KEY, MIZAN_DATABASE_URL
uvicorn app.main:app --reload   # http://localhost:8000/health
pytest -q && ruff check .

# Web (Node 22)
cd apps/web
cp .env.example .env.local
npm install
npm run dev                     # http://localhost:3000
npm test && npm run lint && npm run build
```

Without `MIZAN_DATABASE_URL` the API uses a 39-passage offline corpus; without `ANTHROPIC_API_KEY` it runs rules-only
(`llm_used: false`) and screenshot reading is off. Loading the full corpus: [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Documentation

| Document | Contents |
|---|---|
| [HANDOVER.md](HANDOVER.md) | state, services and accounts, configuration, run/deploy, data, security, open items |
| [docs/IDEA.md](docs/IDEA.md) | problem, solution, statuses, principles, scope, roadmap (Arabic) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | components, data model, search, request flow, failure modes |
| [docs/METHOD.md](docs/METHOD.md) | normalization, matching, status rules, where AI is and is not used |
| [docs/EVALUATION.md](docs/EVALUATION.md) | evaluation sets, metrics, results and their limits |
| [docs/SOURCES_AND_LICENSES.md](docs/SOURCES_AND_LICENSES.md) | content sources, terms, software licenses |
| [docs/LIMITS.md](docs/LIMITS.md) | what Mizan cannot do (Arabic) |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | first-time deploy, cost, dependencies, maintenance, privacy |
| [docs/PITCH.md](docs/PITCH.md) | positioning, demo script, expected questions (Arabic) |
| [eval/README.md](eval/README.md) | evaluation files and commands |

## Sources and attribution

Primary sources, from the challenge's scientific reference package ([details](docs/SOURCES_AND_LICENSES.md)):
- Quran: [QuranEnc](https://quranenc.com), King Fahd Complex mushaf text and approved translations.
- Hadith: [HadeethEnc](https://hadeethenc.com), with its takhrij and ruling.

Supplementary source, **not in the package**, named in every result that uses it (the organisers confirmed on
2026-10-06 that outside sources may be used when the reference is stated):
- [hadith-api](https://github.com/fawazahmed0/hadith-api) (Unlicense): the six books and the Muwatta, with the
  rulings that dataset records.

Mizan is a research and review aid. It is not a religious authority, issues no fatwas and does not grade hadith.

## License

Code: [MIT](LICENSE). Corpus content keeps its own terms ([docs/SOURCES_AND_LICENSES.md](docs/SOURCES_AND_LICENSES.md)).
