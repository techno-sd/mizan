# ميزان | Mizan

**ميزان يفحص الآيات والأحاديث والأقوال المنسوبة في محتواك قبل النشر، ويريك النص كما ورد في مصدره، أو يخبرك بصراحة أنه لم يجده.**

*Mizan checks every verse, hadith and attributed quote in your content against the source text before you publish,
and tells you honestly when it can't find one.*

AI Challenge: Serving Islamic Content 2026 · Track 04: Knowledge and verification tools for those who introduce
Islam.

- **Taking over the project? Start with [HANDOVER.md](HANDOVER.md)** (services, configuration, data, open items).
- Idea and scope: [docs/IDEA.md](docs/IDEA.md)
- **Live demo: https://mizan-islam.vercel.app** (API: https://mizan-api-dslz.onrender.com/health)
- Video (≤ 2 min): not recorded yet; [recording script](docs/PITCH.md). Submission materials remain incomplete.

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
| Postgres schema (`db/migrations/`) + hybrid search function | Organization workspaces with their own approved corpora |
| Arabic document-centred UI, `POST /v1/verify` API; **text-first suggested copy** includes eligible source-based changes by default; optional include/exclude checkboxes and restore-all; clean copy or copy with numbered source notes; uncertain cases remain unchanged and flagged | Reviewer dashboard, durable audit trail, browser and editor add-ons |
| Historical held-out test: **32/33** correct statuses (97%), 0 false support on that small corpus-derived set; 27/27 references agreeing with the approved takhrij ([comparison and limits](eval/results/COMPARISON.md)). Historical word fidelity: **40/40 vs 31/40** ([FIDELITY](eval/results/FIDELITY.md)); popular claims: 37/37 ([CHALLENGE](eval/results/CHALLENGE.md)). These scores predate pipeline 0.2.1 and are not a guarantee for the current build. Backend and corrected-copy regressions run in CI | Independent examples, uncached model evaluation and reviewed database of circulating texts |
| **Verses quoted in 7 languages** (English, French, Spanish, German, Indonesian, Turkish, Urdu): compared word for word with QuranEnc's approved translation in that language (`quran_translations`, `scripts/load_translations.py`); a match is certain and names the translator, another translator's wording falls back to the meaning check | Hadith translations from HadeethEnc; more languages |
| **Check a screenshot**: upload, paste (Ctrl+V) or drop an image of a post; Claude transcribes it word for word (misquotes are kept, interface text is dropped, the image is not stored), the writer reviews the text, then it is checked as usual (`POST /v1/image-text`) | Batch images; read text from video frames |
| **Report a wrong result** inside each finding's expandable source details: the quote, the reader's comment and the corpus version go to a `feedback` review queue (the checked text is never stored) | Specialist review screen for the queue; fixes flow back into the corpus and the test sets |
| Conversational results view: white conversation panel on the cream page background, independently scrolling response with a docked composer, contextual review commentary, concise quote-by-quote explanations with soft inline highlights and numbered citations, a single expandable sources section and reply copying; wording comparisons and separate reported gradings; original-text and suggested-copy views; formal Qur’an script from the source with verse brackets and surah references; suggestion include/exclude choices persist between views; **local HTML review report** with original text, decisions, source evidence, gradings and version metadata (print/save PDF in a browser); compact input privacy disclosure; RTL, light/dark, mobile. The original document stays in its own tab. The commentary and response are composed from verified findings; the next-text composer starts a fresh document review. | Results streamed as found; durable save/share and Word export; English interface; accessibility audit; shared rate limit and daily spending cap |

Pipeline 0.2.1 preserves ordinary Quran alefs and emoji offsets. The proposed copy requires review and leaves
ambiguous or model-assisted matches unchanged. Eligible source-based proposals are included in the draft by default; this is not human approval. The optional changes section lets readers exclude a proposal or restore the defaults.
Reviewer decisions are held only in the current browser session; a new check or reload clears them. The downloaded
report is a local snapshot, not a signed certificate or a completed specialist review. Full documents are sent to Anthropic when the model is enabled;
extracted quotations may be cached without automatic expiry. Set `MIZAN_LLM_CACHE_ENABLED=false` to disable cache
reads and writes; existing cached rows need separate deletion. Target-user testing, the video, and the presentation
are still pending.

## Repository

```
apps/web/            Next.js app (UI + server-side proxy)
services/api/        FastAPI verification service (Python)
db/migrations/ database schema and search function
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
