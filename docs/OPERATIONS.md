# Operations: deploy, cost, maintenance

## 1. Deploy (first time)

1. **Database: Neon** (paid plan), project `mizan`, branch `production`, AWS Frankfurt `eu-central-1`, Postgres 17,
   created on 2026-10-05. Compute: autoscaling 0.5–2 CU, scale to zero off (no cold start during judging).
   - Schema: the files in `supabase/migrations/` applied in order. They revoke from the Supabase roles `anon` and
     `authenticated`, so on a plain Postgres create them first: `create role anon nologin; create role authenticated nologin;`.
   - Loaded: corpus `2026-10-05.2` (approved sources + labelled hadith-api, 45,792 passages, live) and `2026-10-05`
     (approved only, 9,810, kept for rollback). Database ≈ 260 MB. `match_passages` ≈ 0.3–0.4 s per query from Riyadh.
   - Connection: the API uses the **pooled** string (host contains `-pooler`); load the corpus over the direct host
     (the same string without `-pooler`).
   - Before 2026-10-05 the database was Supabase (project `txqjbjcsxnaeuzxmmbke`, Free plan); it moved to Neon
     because the free 500 MB limit could not hold the new corpus. Any Postgres with `pg_trgm` + `pgvector` works.
2. **Corpus**:
   ```bash
   cd services/api
   pip install -e ".[dev]"
   python -m scripts.build_corpus --version 2026-10-05.2
   MIZAN_DATABASE_URL="<direct connection string>" python -m scripts.load_corpus --version 2026-10-05.2
   ```
3. **API on Render** (Frankfurt region, next to the database): New → Blueprint → `techno-sd/mizan`
   (`render.yaml`). Set `ANTHROPIC_API_KEY`, `MIZAN_INTERNAL_API_KEY` (the value in the git-ignored
   `services/api/.env`) and `MIZAN_DATABASE_URL` (Neon **pooled** string). Check `GET /health`: it should report
   45,792 passages.
4. **Web on Vercel**: Add New → Project → import `techno-sd/mizan`, root directory `apps/web` (framework
   detected as Next.js); set `MIZAN_API_URL` (the Render URL) and `MIZAN_INTERNAL_API_KEY` (same value as the API).
5. **Smoke test**: open the site → "جرّب نصًا تجريبيًا" → "افحص المحتوى" → 7 findings, matching
   `services/api/tests/test_demo_regression.py`.

## 2. Keep it alive through judging (until 2026-10-22)

- Paid plans for Render (no sleep) and Neon (scale to zero off) for the judging window.
- Anthropic: prepaid credit for the period plus a spend alert. Repeated inputs hit the cache and cost nothing.
- The web proxy rate-limits each IP (15 requests / 5 min).
- Check `/health` daily (an uptime monitor is fine).

## 3. Cost (estimates; check current price lists)

| Item | Estimate |
|---|---|
| Claude Sonnet 5.5 ($2 / $10 per million input / output tokens) | extraction **measured** on the 76 dev texts (2026-10-05): ≈ 830 input + ≈ 110 output tokens per text, **$0.0028 per text**, p50 2.1 s; scales with length (≈ $0.005–0.01 for a 500-word document). Adjudication only for quotes search cannot match ≈ $0.01 each (estimate). Cached repeats $0. Turning thinking off (`between_tools`) was measured too: same extractions on 76/76 texts, 1.5% fewer output tokens, so it is not used |
| Render Starter (API) | ≈ $7 / month |
| Neon (paid, always-on 0.5 CU minimum) | usage-based; check the Neon billing page |
| Vercel Hobby | $0 (Pro for commercial use) |

1,000 documents per month ≈ $10–20 of model usage (extraction plus some adjudication) plus ≈ $7 for the API host
and the Neon compute and storage.

Cost levers, in order: the cache (free); a lower extraction effort; skipping extraction when rules already found
everything in a short text; batch processing for bulk audits.

## 4. Critical dependencies and alternatives

| Dependency | If unavailable |
|---|---|
| Claude API | rules-only mode works automatically (`llm_used: false`); Claude is also available via AWS Bedrock / Google Vertex for data-residency needs |
| Neon | any Postgres with `pg_trgm` + `pgvector` (same migration); or no database at all: `IndexedRetriever` loads the built corpus JSONL into memory (~4 s per document in the slowest environment we tested) |
| QuranEnc / HadeethEnc APIs | the corpus is versioned and stored in our database; the APIs are only needed to rebuild it |
| Render / Vercel | Docker image and Next.js app run on any container / Node host |

## 5. Maintenance and content review

| Responsibility | Owner | Cadence |
|---|---|---|
| Approving a new source (license + scholarly suitability) | content specialist | per source |
| Building and loading a new corpus version | engineer | per source change |
| Gold set: reviewing labels, adding failure cases | content specialist + engineer | monthly |
| Status wording and disclaimers in the UI | content specialist | on change |
| Threshold / prompt changes | engineer | only with an eval run on the dev split; test split before release |
| Dependency updates, security patches | engineer | monthly |

**Rule:** no change to thresholds, prompts or sources ships without an eval run, and the false support rate must not
rise.

## 6. Privacy

- The full submitted document is not stored in `verification_runs`; that log keeps a SHA-256 of the input, its length
  and the summary counts. The document is sent to Anthropic when model extraction is enabled.
- The LLM cache stores Claude's extraction output (which contains the extracted quotes) keyed by a hash. To avoid
  storing extracted quotations, set `MIZAN_LLM_CACHE_ENABLED=false`. This disables cache reads and writes; it does
  not delete existing rows. The default cache has **no automatic expiry**: entries remain until the operator deletes
  them. An operator may configure scheduled deletion separately, but no retention job is included in this build.
- Feedback stores the reported quotation and comment for specialist review. The UI discloses both caching and
  feedback storage; a hash cache key does not anonymize the cached quotation.
- Anthropic API data handling follows the organization's agreement with Anthropic.
