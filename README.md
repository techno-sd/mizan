# ميزان | Mizan

**ميزان يفحص الآيات والأحاديث والأقوال المنسوبة في محتواك قبل النشر، ويريك النص كما ورد في مصدره، أو يخبرك بصراحة أنه لم يجده.**

*Mizan checks every verse, hadith and attributed quote in your content against the source text before you publish,
and tells you honestly when it can't find one.*

AI Challenge: Serving Islamic Content 2026 · Track 04: Knowledge and verification tools for those who introduce
Islam.

- Idea and scope: [docs/IDEA.md](docs/IDEA.md)
- **Live demo: https://mizan-islam.vercel.app** (API: https://mizan-api-dslz.onrender.com/health)
- Video (≤ 2 min): _add the link_

---

## What it does

Paste an article, post or video script. Mizan:

1. finds every Quran verse, hadith and attributed quote (rules + Claude), and the reference the author cited;
2. matches each one against **the challenge's approved sources first**: the Quran from QuranEnc (King Fahd Complex mushaf text) and 3,574 hadith from HadeethEnc, each with its approved takhrij and ruling. Hadith not there are looked up in one supplementary source (hadith-api: the six books and the Muwatta), and **every result names its source** and says whether it is in the challenge's package;
3. shows, per quote: whether the text and reference match, a word-by-word diff, the source passage with the matched
   part highlighted in context, the correct reference, and scholars' gradings **as reported, with their names**;
4. says "not found in the loaded sources" instead of inventing one, and flags conflicting gradings or ambiguous
   matches for a specialist.

Two separate axes: the **reference** (Mizan decides, with deterministic rules) and the **reported gradings**
(scholars decide; Mizan only reports). "Matches the source" means the text exists, not that it is authentic.

## Status (built during the challenge, 4–6 Oct 2026)

| Built | Proposed next |
|---|---|
| Verification pipeline, five statuses + specialist flag, deployed (Vercel + Render + Neon Postgres, Frankfurt) | Multilingual embeddings for meaning and translation matches |
| Corpus: 6,236 ayat (QuranEnc) + 3,574 hadith (HadeethEnc) from the approved sources, + 35,982 hadith from a labelled supplementary source (hadith-api), versioned, checksummed | More approved translation languages; Dorar / Shamela coverage if access is granted |
| Postgres schema (`supabase/migrations/`) + hybrid search function | Organization workspaces with their own approved corpora |
| Arabic document-centred UI, `POST /v1/verify` API; **corrected copy**: the text with each quote's wording and reference taken from its source, numbered source notes, and flags for what the writer must decide (nothing in it is written by a model) | Reviewer dashboard, audit trail, browser and editor add-ons |
| Held-out test: 97% status accuracy, 0% false support, 100% references agreeing with the approved takhrij (same model used directly: 85-88% / 93%) ([comparison](eval/results/COMPARISON.md)). Word fidelity: **40/40 vs 31/40** for the same model used directly, which flagged 7 of 10 correctly quoted hadith as altered ([FIDELITY](eval/results/FIDELITY.md)). Popular claims: 37/37, 0 invented references ([CHALLENGE](eval/results/CHALLENGE.md)). 60+ tests in CI | Reviewed database of circulating texts |
| **Report a wrong result** on every card: the quote, the reader's comment and the corpus version go to a `feedback` review queue for specialists (the checked text is never stored) | Specialist review screen for the queue; fixes flow back into the corpus and the test sets |
| Plain verdict → fix → source on each card, details on demand; RTL, light/dark, mobile | Apply one fix in place; edit and re-check; results streamed as found; save/share/export (PDF, Word); English interface; accessibility audit; shared rate limit and daily spending cap |

## Repository

```
apps/web/            Next.js app (UI + server-side proxy)
services/api/        FastAPI verification service (Python)
supabase/migrations/ database schema and search function
eval/                gold set format, eval runner, demo script, baselines
docs/                idea, architecture, method, evaluation, sources, limits, operations, plan, pitch
```

## Run locally

**API** (Python 3.12):

```bash
cd services/api
pip install -e ".[dev]"
cp .env.example .env          # optional: ANTHROPIC_API_KEY, MIZAN_DATABASE_URL
uvicorn app.main:app --reload # http://localhost:8000/health
pytest -q
```

Without `MIZAN_DATABASE_URL` the API uses a small real corpus (`app/data/fixture_passages.json`); without
`ANTHROPIC_API_KEY` it runs in rules-only mode.

**Web** (Node 20+):

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev                   # http://localhost:3000
```

**Full corpus into Postgres (Neon)**: see [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Documentation

| Document | Contents |
|---|---|
| [IDEA.md](docs/IDEA.md) | problem, solution, statuses, principles, scope, differentiation, roadmap (Arabic) |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | components, data model, search, request flow, failure modes |
| [METHOD.md](docs/METHOD.md) | normalization, detection, matching, status rules, where AI is and is not used |
| [EVALUATION.md](docs/EVALUATION.md) | gold set, metrics, ablations, baselines, user test |
| [SOURCES_AND_LICENSES.md](docs/SOURCES_AND_LICENSES.md) | content sources, terms, software licenses |
| [LIMITS.md](docs/LIMITS.md) | what Mizan cannot do (Arabic) |
| [OPERATIONS.md](docs/OPERATIONS.md) | deploy, cost, dependencies, maintenance and content review |
| [BUILD_PLAN.md](docs/BUILD_PLAN.md) | 3-day plan, submission checklist, judging criteria map (Arabic) |
| [PITCH.md](docs/PITCH.md) | pitch, 2-minute video script, Q&A (Arabic) |

## Sources and attribution

Primary sources, from the challenge's scientific reference package ([details](docs/SOURCES_AND_LICENSES.md)):
- Quran: [موسوعة القرآن الكريم — QuranEnc](https://quranenc.com), King Fahd Complex mushaf text and the approved English translation.
- Hadith: [موسوعة الأحاديث النبوية — HadeethEnc](https://hadeethenc.com), with its takhrij and ruling.

Supplementary source, **not in the package**, named in every result that uses it (the organisers confirmed on 2026-10-06
that outside sources may be used when the reference is stated):
- [hadith-api](https://github.com/fawazahmed0/hadith-api) (Unlicense): the six books and the Muwatta, with the gradings that dataset records.

Mizan is a research and review aid. It is not a religious authority, issues no fatwas and does not grade hadith.

## License

Code: [MIT](LICENSE). Corpus content keeps its own terms (see above and
[docs/SOURCES_AND_LICENSES.md](docs/SOURCES_AND_LICENSES.md)).
