# Architecture

## Overview

```
Browser ──► Next.js (Vercel) ──server-side, X-Internal-Key──► FastAPI service (Render, Docker, Frankfurt)
            apps/web                                           services/api
            · UI (Arabic, RTL)                                 · verification pipeline
            · /api/verify, /api/image-text,                    ├─► Postgres (Neon, Frankfurt)
              /api/feedback proxies + rate limits              │     passages · sources · corpus_versions · lexeme_df
                                                               │     quran_translations · feedback
                                                               │     llm_cache · verification_runs
                                                               │     match_passages() · match_translation()
                                                               └─► Claude API (claude-sonnet-5-5)
```

The browser never talks to the API directly: no CORS, the API URL and key stay server-side, and rate limiting lives
in one place.

## Repository layout

```
apps/web/                 Next.js app (UI + /api/verify, /api/image-text, /api/feedback proxies)
  src/lib/review-text.ts  deterministic reply wording (verdict, differences, rulings) from the API response
  src/lib/corrected.ts    suggested corrected copy built from source passages only
services/api/
  app/
    config.py             settings (env prefix MIZAN_)
    schemas.py            public API contract (v1)
    normalize.py          Arabic/English normalization (+ index map back to the original text)
    references.py         collections registry, surah names, parsing of cited references
    extract.py            rule-based quote detection, locating quotes in the text, merging sources
    retrieve.py           Retriever interface: InMemoryRetriever (fixture) / PostgresRetriever (+ translations)
    language.py           language of a quote (Urdu, Latin-script languages) and the approved translation per language
    align.py              similarity, match type, word diff, matched-span highlight
    rules.py              status rules, reference check, gradings
    llm.py                Claude: extraction, source proposals, adjudication, screenshot transcription (JSON schema)
    store.py              LLM cache + run log + readers' feedback (memory / Postgres)
    pipeline.py           orchestration
    main.py               FastAPI app
    data/                 surahs.json (surah names), fixture_passages.json (39-passage offline corpus)
  scripts/                build_corpus.py, load_corpus.py, fetch_translations.mjs, load_translations.py,
                          eval_offline.py, ref_validity.py, demo.py
  tests/                  unit + real-text regression tests
db/migrations/      plain Postgres migrations (run on Neon): schema, search functions, feedback, translations
eval/                     gold set, eval runner, demo script, baseline protocol
docs/                     this documentation
```

## Swappable parts

Every part that is likely to change sits behind a small interface; the current build uses the simple implementation.

| Interface | Now | Production path |
|---|---|---|
| `Retriever` | `PostgresRetriever` (Postgres FTS + `pg_trgm` + optional `pgvector`), `InMemoryRetriever` for offline/tests | OpenSearch for organization-uploaded corpora |
| `LLMClient` | `ClaudeClient` (Anthropic API) | same, or Claude via Bedrock/Vertex for data-residency clients |
| `Store` | `PostgresStore` / `MemoryStore` | same |
| Corpus | versioned build (`build_corpus.py`) → JSONL → `load_corpus.py` | same, plus per-organization corpora |

## Data model (Postgres on Neon)

- `sources`: registry of sources with license text (rendered in [SOURCES_AND_LICENSES.md](SOURCES_AND_LICENSES.md)).
- `corpus_versions`: one row per corpus build, with its manifest (download URLs + SHA-256, counts).
- `passages`: one row per ayah or hadith. `text_ar`/`text_en` are verbatim; `*_norm` columns are derived for search
  only. `gradings` is `[{scholar, grade}]` exactly as the source provides. `fts` is a generated `tsvector`.
- `llm_cache`: Claude results keyed by `sha256(task, prompt_version, model, input)`.
- `verification_runs`: run log with the **input hash**, never the input text.
- `lexeme_df`: document frequency per word, refreshed after each corpus load (`select refresh_lexeme_df();`).
- `quran_translations`: approved QuranEnc translations, one row per ayah and language (en, fr, es, de, id, tr, ur).
- `feedback`: readers' "this result is wrong / right" reports with the quote, comment, versions and a
  `review_state` (new → confirmed / rejected → fixed) for specialists. Never the checked text.

RLS is enabled on every table with no policies: only the service's server-side connection can read or write.

## Search: `match_passages(q, kind, embedding, k, corpus_version)`

Reciprocal rank fusion of up to four candidate lists (60 each):

1. full-text search with an OR query of the **4 rarest** query words (found in < 3% of passages, from the
   `lexeme_df` table; `simple` config: no stemming). Using all words made common ones (في، من، الله) match ~15,000
   passages and took ~8 s;
2. `word_similarity(q, text_ar_norm)`: trigram similarity that works for a short quote inside a long hadith;
3. the same over `text_en_norm` (English quotes of hadith translations);
4. cosine distance over `embedding` when an embedding is supplied (not used yet: the column is empty).

The function returns ids and fused scores. The service then aligns each candidate exactly (`align.py`): retrieval
only proposes, it never decides.

Measured on Neon with corpus `2026-10-05.2` (45,792 passages; client in Riyadh, database in Frankfurt): 0.3–0.4 s per
query, the expected passage at rank 1–2 for Arabic quotes. Database ≈ 290 MB. After loading a corpus run
`select refresh_lexeme_df();` (the loaders do this).

## Other endpoints

- `POST /v1/image-text`: transcribes a screenshot word for word (Claude vision, JSON output; misquotes kept, interface
  text dropped). The image is neither stored nor cached; the writer reviews the text, then it is verified as usual.
- `POST /v1/feedback`: stores a reader's report on one result.
- `GET /health`: corpus version, passage count, model; also keeps the database warm.

> On a new database, check `select word_similarity('انما الاعمال بالنيات', 'حدثنا ... انما الاعمال بالنيات');`: it
> must return a high value. If it returns 0, the database locale treats Arabic letters as non-word characters; fall
> back to FTS-only candidates (alignment in Python still works).

## Request flow (`POST /v1/verify`)

1. Rule-based detection (markers such as ﴿﴾, «قال تعالى», «قال رسول الله ﷺ», "The Prophet ﷺ said").
2. Claude extraction (one call per document, JSON schema). Each item is located in the original text; items that
   cannot be located are dropped.
3. Merge both sources by span overlap.
4. For each item, concurrently: retrieve → align → group matches → (only if nothing matched: Claude proposes
   source locations, which are looked up and aligned like any candidate; then Claude adjudication and verification
   of the excerpt it cites) → reference check → gradings → status.
5. Summary + run log (hash only).

## Determinism

- Everything except the Claude calls is deterministic.
- Claude outputs are cached by input, so a repeated input returns the same result even though Claude Sonnet 5.5 does
  not accept `temperature`.
- The eval runner measures consistency across repeated runs (see [EVALUATION.md](EVALUATION.md)). With caching
  enabled this measures cache-backed repeatability, not independent model stability. Disable the cache with
  `MIZAN_LLM_CACHE_ENABLED=false` when measuring independent calls.

## Failure modes

| Failure | Behaviour |
|---|---|
| No `ANTHROPIC_API_KEY` / API error / refusal | rules-only mode: markers-based detection, no adjudication; the response says `llm_used: false` |
| No database URL | offline mode with the fixture corpus (39 real passages) |
| `quran_translations` not loaded | translated verses use the meaning check (Claude + review flag); a warning is logged |
| Image reading without the model | `/v1/image-text` returns 503; the web app asks the writer to paste the text |
| API cold start | the web app shows "the service may be starting, retry" |
| Input > 20,000 chars | 413 |
