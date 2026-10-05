# Operations: deploy, cost, maintenance

## 1. Deploy (first time)

1. **Supabase**: project `mizan` (ref `txqjbjcsxnaeuzxmmbke`, Frankfurt `eu-central-1`, Free plan) was created on
   2026-10-04 and the migration is applied. Arabic trigram matching was verified: a partial quote inside a long hadith
   scores 1.0 (`lc_ctype = en_US.UTF-8`).
   - Free plan caveats: 500 MB database (check size after loading; drop `passages_en_trgm_idx` first if needed) and
     pausing after about a week without activity. `/health` queries the database, so Render's health checks keep it
     active.
   - Corpus `2026-10-05` (approved sources only: QuranEnc + HadeethEnc, 9,810 passages) loaded on 2026-10-05. Connection: use the pooler host
     shown in Supabase → Connect (for this project `aws-1-eu-central-1.pooler.supabase.com`), and percent-encode
     special characters in the password (`@` → `%40`).
   - For a new project: SQL editor → run the files in `supabase/migrations/` in order (or `supabase db push`), then
     `select extensions.word_similarity('انما الاعمال بالنيات', 'حدثنا الحميدي انما الاعمال بالنيات');` → high, not 0.
2. **Corpus**:
   ```bash
   cd services/api
   pip install -e ".[dev]"
   python -m scripts.build_corpus --version 2026-10-04
   MIZAN_DATABASE_URL="<direct connection string>" python -m scripts.load_corpus --version 2026-10-04
   ```
3. **API on Render** (Frankfurt region, next to the database): New → Blueprint → `techno-sd/mizan`
   (`render.yaml`). Set `ANTHROPIC_API_KEY`, `MIZAN_INTERNAL_API_KEY` (the value in the git-ignored
   `services/api/.env`) and `MIZAN_DATABASE_URL` (**transaction pooler** string, port 6543). Check `GET /health`:
   it should report 9,810 passages.
4. **Web on Vercel**: Add New → Project → import `techno-sd/mizan`, root directory `apps/web` (framework
   detected as Next.js); set `MIZAN_API_URL` (the Render URL) and `MIZAN_INTERNAL_API_KEY` (same value as the API).
5. **Smoke test**: open the site → "جرّب نصًا تجريبيًا" → "افحص المحتوى" → 7 findings, matching
   `services/api/tests/test_demo_regression.py`.

## 2. Keep it alive through judging (until 2026-10-22)

- Paid plans for Render (no sleep) and Supabase (no pause) for the judging window.
- Anthropic: prepaid credit for the period plus a spend alert. Repeated inputs hit the cache and cost nothing.
- The web proxy rate-limits each IP (15 requests / 5 min).
- Check `/health` daily (an uptime monitor is fine).

## 3. Cost (estimates; check current price lists)

| Item | Estimate |
|---|---|
| Claude Sonnet 5.5 ($2 / $10 per million input / output tokens) | extraction ≈ 2k input + ≈ 1–2k output per 500-word document ≈ **$0.015–0.025**; adjudication only for unmatched quotes ≈ $0.01–0.015 each. Typical document **≈ $0.025–0.05**; cached repeats $0 |
| Render Starter (API) | ≈ $7 / month |
| Supabase Pro | ≈ $25 / month |
| Vercel Hobby | $0 (Pro for commercial use) |

1,000 documents per month ≈ $25–50 of model usage plus ≈ $7 of hosting (Supabase free) or ≈ $32 with Supabase Pro.

Cost levers, in order: the cache (free); a lower extraction effort; skipping extraction when rules already found
everything in a short text; batch processing for bulk audits.

## 4. Critical dependencies and alternatives

| Dependency | If unavailable |
|---|---|
| Claude API | rules-only mode works automatically (`llm_used: false`); Claude is also available via AWS Bedrock / Google Vertex for data-residency needs |
| Supabase | any Postgres with `pg_trgm` + `pgvector` (same migration); or no database at all: `IndexedRetriever` loads the built corpus JSONL into memory (~4 s per document in the slowest environment we tested) |
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

- The user's text is not stored. `verification_runs` keeps a SHA-256 of the input, its length and the summary counts.
- The LLM cache stores Claude's extraction output (which contains the extracted quotes) keyed by a hash. To avoid
  storing any user content, set a short retention (e.g. delete `llm_cache` rows older than 30 days) or disable the
  Postgres cache.
- Anthropic API data handling follows the organization's agreement with Anthropic.
