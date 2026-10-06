# Mizan: handover

Mizan checks the Quran verses and hadith quoted in a text before it is published: it finds each quote, compares it
word for word with its source, says what is wrong (reference, wording, not found), shows the source and the reported
rulings, and offers a corrected copy built only from the sources. Built for the AI Challenge Serving Islamic Content
2026, Track 4.

- Live: https://mizan-islam.vercel.app · API health: https://mizan-api-dslz.onrender.com/health
- Code: https://github.com/techno-sd/mizan (MIT)
- Start here, then: [README](README.md) · [Architecture](docs/ARCHITECTURE.md) · [Method](docs/METHOD.md) ·
  [Operations](docs/OPERATIONS.md) · [Sources and licenses](docs/SOURCES_AND_LICENSES.md) · [Limits](docs/LIMITS.md) ·
  [Evaluation](docs/EVALUATION.md) · [Idea](docs/IDEA.md) · [Pitch](docs/PITCH.md) · [eval/](eval/README.md)

## 1. State at handover (2026-10-07)

| | |
|---|---|
| Live build | commit on `main` deployed by Vercel (web) and Render (API) on every push; CI green |
| Pipeline | 0.2.1 (`services/api/app/__init__.py`) |
| Corpus | `2026-10-05.2`, 45,792 passages: QuranEnc 6,236 ayat + HadeethEnc 3,574 hadith (approved sources) + hadith-api 35,982 (supplementary, labelled in every result) |
| Model | Claude Sonnet 5.5 (`claude-sonnet-5-5`) for quote extraction, source proposals, adjudication, screenshot transcription |
| Tests | API 94 (pytest) · web 53 (`npm test`) · ruff, eslint, tsc, `next build` in CI |
| Evaluation | word fidelity 40/40 (same model alone 31/40), popular claims 37/37, held-out test 32/33. Measured **before** pipeline 0.2.1: rerun before quoting them for this build ([details and limits](docs/EVALUATION.md)) |

Features live: verification of Arabic and English quotes; grouped chat-style reply (verdict, exact wording
difference, the fix, rulings with the book they concern, numbered sources); suggested corrected copy with per-change
decisions; downloadable review report; "report a wrong result" queue; screenshot check (upload / paste / drop).

Built but **not active yet**: verses quoted in French, Spanish, German, Indonesian, Turkish and Urdu (and English)
compared with QuranEnc's approved translations. The code is deployed; the data is not loaded (see 5.1).

## 2. Services and accounts

| Service | What | Settings to know |
|---|---|---|
| GitHub `techno-sd/mizan` | code, CI (`.github/workflows/ci.yml`) | push to `main` deploys both apps |
| Vercel project `mizan` | web app, root `apps/web` | env: `MIZAN_API_URL`, `MIZAN_INTERNAL_API_KEY` |
| Render service `mizan-api` | API, Docker (`services/api/Dockerfile`), Blueprint `render.yaml`, plan `0.5c-512mb`, Frankfurt | env: see 3; `MIZAN_CORPUS_VERSION` and `MIZAN_LLM_MODEL` come from `render.yaml` |
| Neon project `mizan`, branch `production` | Postgres 17, AWS Frankfurt, autoscaling 0.5–2 CU, scale to zero off | both the pooled and the direct host accepted a connection from the maintainer's machine on 2026-10-07; earlier "connection reset" errors from outside Render suggest an IP allow-list or branch protection, so if they return check Settings → Network security |
| Anthropic | Claude API key used by the API | spend shows in the Anthropic console |
| Supabase `txqjbjcsxnaeuzxmmbke` | **old database, no longer used** | pause or delete it |

## 3. Configuration

API (`services/api`, prefix `MIZAN_`, read from the environment or `.env`; template: `services/api/.env.example`):

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude. Without it the API runs in rules-only mode (`llm_used: false`), and image reading is off |
| `MIZAN_INTERNAL_API_KEY` | shared secret; the web app sends it as `X-Internal-Key` |
| `MIZAN_DATABASE_URL` | Neon **pooled** connection string. Empty = offline fixture corpus (39 passages) |
| `MIZAN_CORPUS_VERSION` | which loaded corpus to search (`2026-10-05.2`; `2026-10-05` = approved sources only, kept for rollback) |
| `MIZAN_LLM_MODEL`, `MIZAN_LLM_EFFORT_EXTRACT`, `MIZAN_LLM_EFFORT_ADJUDICATE`, `MIZAN_LLM_FALLBACKS`, `MIZAN_LLM_CACHE_ENABLED`, `MIZAN_LLM_ENABLED` | model settings; `LLM_CACHE_ENABLED=false` stops caching extracted quotations |
| `MIZAN_T_EXACT` (92), `MIZAN_T_VARIANT` (75), `MIZAN_MAX_INPUT_CHARS` (20,000) | matching thresholds, input limit |

Web (`apps/web/.env.local` locally, Vercel env in production): `MIZAN_API_URL`, `MIZAN_INTERNAL_API_KEY`.

## 4. Run, test, deploy

```bash
# API (Python 3.12)
cd services/api && pip install -e ".[dev]" && uvicorn app.main:app --reload   # http://localhost:8000/health
pytest -q && ruff check .

# Web (Node 22)
cd apps/web && npm install && npm run dev                                      # http://localhost:3000
npm test && npm run lint && npm run build
```

- On **Windows**, the async Postgres driver cannot use the default event loop: run the API with an empty
  `MIZAN_DATABASE_URL` (fixture corpus), or use WSL/Linux for the database. Production runs on Linux.
- Deploy = merge to `main`. Rollback: Vercel → Deployments → promote the previous one; Render → Events → rollback.
  A data rollback is only `MIZAN_CORPUS_VERSION=2026-10-05` on Render.

## 5. Data

- Migrations: `db/migrations/*.sql`, plain Postgres (any Postgres with `pg_trgm` and `pgvector`), applied in name
  order. The project started on Supabase; the live database is Neon.
- Corpus: `python -m scripts.build_corpus --version <v>` then `python -m scripts.load_corpus --version <v>` (direct
  host), then set `MIZAN_CORPUS_VERSION`. Sources are cached in `services/api/.cache/sources` (git-ignored).
- Hadith-api is supplementary (not in the challenge package); the organisers confirmed outside sources may be used
  when the reference is stated, which every result does.

### 5.1 To finish: load the Quran translations

```bash
cd services/api
node scripts/fetch_translations.mjs              # QuranEnc, 7 languages × 6,236 ayat → .cache/sources
psql "$DIRECT_URL" -f ../../db/migrations/20261006020000_quran_translations.sql
python -m scripts.load_translations              # reads MIZAN_DATABASE_URL; uses the direct host
```

Checked on 2026-10-07: the live database has **no `quran_translations` table yet** (the migration is not applied), so
translated verses use the meaning check with a review flag and the API logs `translation lookup failed`. Run these
steps from a machine Neon accepts (see section 2). On Windows run the loaders from WSL/Linux.

## 6. Evaluation

`eval/README.md` explains the sets. Scores are reproducible from saved answers:
`node eval/score_fidelity.mjs`, `node eval/score_challenge.mjs`, `python eval/run_eval.py --responses …`.
Offline check without the model or database:
`MIZAN_LLM_ENABLED=false python -m scripts.eval_offline --version 2026-10-05.2 --gold ../../eval/fidelity.jsonl --split fidelity`.
Limits of every number are written next to it; do not present them as general accuracy.

## 7. Security and privacy

- Secrets live only in the git-ignored `services/api/.env`, `apps/web/.env.local`, Vercel and Render. The public repo
  history was scanned: no keys or passwords.
- **Rotate after handover** (they were shared in chats or screenshots during the build): Neon `neondb_owner`
  password, `MIZAN_INTERNAL_API_KEY` (update Render and Vercel together), the old Supabase password.
- Stored data: run log keeps a hash of the input, never the text; the LLM cache keeps extracted quotations (no expiry;
  disable with `MIZAN_LLM_CACHE_ENABLED=false`); feedback keeps the reported quote and comment; images are not stored.
- The web proxies rate-limit per IP **in memory, per server instance**: not a real limit on Vercel. Move to a shared
  store (e.g. Upstash Redis or a Neon table) and add a daily spending cap before wider launch.

## 8. Open items, in priority order

1. Load the Quran translations (5.1).
2. Target-user test ([eval/user_test.md](eval/user_test.md)) and specialist review of labels and wording
   ([eval/specialist_review.md](eval/specialist_review.md)): both still pending.
3. Shared rate limit and spending cap (7); uptime alert on `/health`.
4. A specialist screen for the `feedback` queue (2 reports were in it on 2026-10-07: read them).
5. Proposed features: hadith translations (HadeethEnc), Telegram/WhatsApp bot, browser extension, curated database of
   circulating texts with documented verdicts, English interface, file/URL upload.
