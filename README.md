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
2. matches each one against a declared corpus: the Quran (Tanzil) and nine hadith collections (36,064 hadith);
3. shows, per quote: whether the text and reference match, a word-by-word diff, the source passage with the matched
   part highlighted in context, the correct reference, and scholars' gradings **as reported, with their names**;
4. says "not found in the loaded sources" instead of inventing one, and flags conflicting gradings or ambiguous
   matches for a specialist.

Two separate axes: the **reference** (Mizan decides, with deterministic rules) and the **reported gradings**
(scholars decide; Mizan only reports). "Matches the source" means the text exists, not that it is authentic.

## Status (built during the challenge, 4–6 Oct 2026)

| Built | Proposed next |
|---|---|
| Verification pipeline, five statuses + specialist flag, deployed (Vercel + Render + Supabase, Frankfurt) | Multilingual embeddings for meaning and translation matches |
| Corpus build: 6,236 ayat + 36,064 hadith, versioned, checksummed | Licensed Quran translations; more languages |
| Supabase schema + hybrid search function | Organization workspaces with their own approved corpora |
| Arabic document-centred UI, `POST /v1/verify` API | Reviewer dashboard, audit trail, browser and editor add-ons |
| 48 tests (CI on every push); 120-item gold set; dev false support rate 18% → 0% (see eval/results/HISTORY.md) | Reviewed database of circulating texts |

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

**Full corpus into Supabase**: see [docs/OPERATIONS.md](docs/OPERATIONS.md).

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

- Quran text: [Tanzil Project](https://tanzil.net), used verbatim; changing the text is not allowed.
- Hadith texts and gradings: [fawazahmed0/hadith-api](https://github.com/fawazahmed0/hadith-api) (Unlicense).

Mizan is a research and review aid. It is not a religious authority, issues no fatwas and does not grade hadith.

## License

Code: [MIT](LICENSE). Corpus content keeps its own terms (see above and
[docs/SOURCES_AND_LICENSES.md](docs/SOURCES_AND_LICENSES.md)).
