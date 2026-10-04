# Architecture

## Overview

```
Browser ──► Next.js (Vercel) ──server-side, X-Internal-Key──► FastAPI service (Render, Docker)
            apps/web                                           services/api
            · UI (Arabic, RTL)                                 · verification pipeline
            · /api/verify proxy + rate limit                   ├─► Supabase Postgres
                                                               │     passages · sources · corpus_versions
                                                               │     llm_cache · verification_runs
                                                               │     match_passages() hybrid search
                                                               └─► Claude API (claude-opus-5-5)
```

The browser never talks to the API directly: no CORS, the API URL and key stay server-side, and rate limiting lives
in one place.

## Repository layout

```
apps/web/                 Next.js app (UI + /api/verify proxy)
services/api/
  app/
    config.py             settings (env prefix MIZAN_)
    schemas.py            public API contract (v1)
    normalize.py          Arabic/English normalization (+ index map back to the original text)
    references.py         collections registry, surah names, parsing of cited references
    extract.py            rule-based quote detection, locating quotes in the text, merging sources
    retrieve.py           Retriever interface: InMemoryRetriever (fixture) / SupabaseRetriever
    align.py              similarity, match type, word diff, matched-span highlight
    rules.py              status rules, reference check, gradings
    llm.py                Claude: extraction + adjudication (JSON-schema output, cached)
    store.py              LLM cache + run log (memory / Postgres)
    pipeline.py           orchestration
    main.py               FastAPI app
    data/                 surahs.json (Tanzil metadata), fixture_passages.json (offline corpus)
  scripts/                build_corpus.py, load_corpus.py, demo.py
  tests/                  unit + real-text regression tests
supabase/migrations/      schema, indexes, match_passages()
eval/                     gold set, eval runner, demo script, baseline protocol
docs/                     this documentation
```

## Swappable parts

Every part that will change for production sits behind a small interface; the hackathon build uses the simple
implementation.

| Interface | Now | Production path |
|---|---|---|
| `Retriever` | `SupabaseRetriever` (Postgres FTS + `pg_trgm` + optional `pgvector`), `InMemoryRetriever` for offline/tests | OpenSearch for organization-uploaded corpora |
| `LLMClient` | `ClaudeClient` (Anthropic API) | same, or Claude via Bedrock/Vertex for data-residency clients |
| `Store` | `PostgresStore` / `MemoryStore` | same |
| Corpus | versioned build (`build_corpus.py`) → JSONL → `load_corpus.py` | same, plus per-organization corpora |

## Data model (Supabase)

- `sources`: registry of sources with license text (rendered in [SOURCES_AND_LICENSES.md](SOURCES_AND_LICENSES.md)).
- `corpus_versions`: one row per corpus build, with its manifest (download URLs + SHA-256, counts).
- `passages`: one row per ayah or hadith. `text_ar`/`text_en` are verbatim; `*_norm` columns are derived for search
  only. `gradings` is `[{scholar, grade}]` exactly as the source provides. `fts` is a generated `tsvector`.
- `llm_cache`: Claude results keyed by `sha256(task, prompt_version, model, input)`.
- `verification_runs`: run log with the **input hash**, never the input text.

RLS is enabled on every table with no policies: only the service's server-side connection can read or write.

## Search: `match_passages(q, kind, embedding, k, corpus_version)`

Reciprocal rank fusion of up to four candidate lists (60 each):

1. full-text search with an OR query of the normalized words (`simple` config: no stemming, exact quotes matter);
2. `word_similarity(q, text_ar_norm)`: trigram similarity that works for a short quote inside a long hadith;
3. the same over `text_en_norm` (English quotes of hadith translations);
4. cosine distance over `embedding` when an embedding is supplied (optional, Day 2+).

The function returns ids and fused scores. The service then aligns each candidate exactly (`align.py`): retrieval
only proposes, it never decides.

> Check on Day 1: `select word_similarity('انما الاعمال بالنيات', 'حدثنا ... انما الاعمال بالنيات');` must
> return a high value. If it returns 0, the database locale treats Arabic letters as non-word characters; fall back to
> FTS-only candidates (alignment in Python still works).

## Request flow (`POST /v1/verify`)

1. Rule-based detection (markers such as ﴿﴾, «قال تعالى», «قال رسول الله ﷺ», "The Prophet ﷺ said").
2. Claude extraction (one call per document, JSON schema). Each item is located in the original text; items that
   cannot be located are dropped.
3. Merge both sources by span overlap.
4. For each item, concurrently: retrieve → align → group matches → (Claude adjudication only if nothing matched,
   then verify the excerpt it cites) → reference check → gradings → status.
5. Summary + run log (hash only).

## Determinism

- Everything except the two Claude calls is deterministic.
- Claude outputs are cached by input, so a repeated input returns the same result even though Claude Opus 5.5 does
  not accept `temperature`.
- The eval runner measures consistency across repeated runs (see [EVALUATION.md](EVALUATION.md)).

## Failure modes

| Failure | Behaviour |
|---|---|
| No `ANTHROPIC_API_KEY` / API error / refusal | rules-only mode: markers-based detection, no adjudication; the response says `llm_used: false` |
| No database URL | offline mode with the fixture corpus (31 real passages) |
| API cold start | the web app shows "the service may be starting, retry" |
| Input > 20,000 chars | 413 |
