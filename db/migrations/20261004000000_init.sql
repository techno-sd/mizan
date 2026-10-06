-- Mizan initial schema.
-- Corpus tables are versioned: every verification run records the corpus_version it used.
-- Plain Postgres (runs on Neon; started on Supabase). The roles below exist on Supabase; elsewhere they are created
-- so the "revoke ... from anon, authenticated" statements in these migrations work.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists vector with schema extensions;

-- Sources registry (also rendered in docs/SOURCES_AND_LICENSES.md).
create table if not exists sources (
  id          text primary key,
  title       text not null,
  kind        text not null check (kind in ('quran', 'hadith', 'grading', 'other')),
  url         text,
  license     text not null,
  notes       text
);

create table if not exists corpus_versions (
  id          text primary key,
  created_at  timestamptz not null default now(),
  manifest    jsonb not null default '{}'::jsonb
);

-- One row per ayah or hadith. text_* are verbatim; *_norm are derived for search only.
create table if not exists passages (
  id                bigint generated always as identity primary key,
  corpus_version    text not null references corpus_versions (id) on delete cascade,
  source_id         text not null references sources (id),
  collection        text not null,               -- quran | bukhari | muslim | ...
  kind              text not null check (kind in ('quran', 'hadith')),
  book              int,                         -- surah number, or book/section number
  number            int,                         -- ayah number, or hadith number (integer part)
  number_label      text,                        -- exact label, e.g. "2:255" or "55.01"
  numbering_scheme  text,
  text_ar           text not null,
  text_ar_norm      text not null,
  text_en           text,
  text_en_norm      text,
  gradings          jsonb not null default '[]'::jsonb,   -- [{scholar, grade}] as provided by the source
  url               text,
  extra             jsonb not null default '{}'::jsonb,
  embedding         extensions.vector(1024),     -- optional; filled by an embedding job
  fts               tsvector generated always as (
                      to_tsvector('simple', text_ar_norm || ' ' || coalesce(text_en_norm, ''))
                    ) stored
);

create index if not exists passages_version_collection_idx on passages (corpus_version, collection, book, number);
create index if not exists passages_fts_idx on passages using gin (fts);
create index if not exists passages_ar_trgm_idx on passages using gin (text_ar_norm extensions.gin_trgm_ops);
create index if not exists passages_en_trgm_idx on passages using gin (text_en_norm extensions.gin_trgm_ops);
create index if not exists passages_embedding_idx on passages using hnsw (embedding extensions.vector_cosine_ops);

-- Claude results keyed by hash(prompt version, model, input): repeatable output and lower cost.
create table if not exists llm_cache (
  key             text primary key,
  model           text not null,
  prompt_version  text not null,
  response        jsonb not null,
  created_at      timestamptz not null default now()
);

-- Run log. Stores a hash of the input, never the input text itself.
create table if not exists verification_runs (
  id                text primary key,
  created_at        timestamptz not null default now(),
  corpus_version    text not null,
  api_version       text not null,
  pipeline_version  text not null,
  prompt_version    text not null,
  llm_model         text,
  input_sha256      text not null,
  input_chars       int not null,
  summary           jsonb not null,
  duration_ms       int
);

-- Hybrid candidate search: full-text (OR of query words) + trigram word_similarity + optional vector,
-- fused with reciprocal rank fusion. Returns passage ids; the service does the exact alignment.
-- Superseded by 20261005000000_fast_search.sql (rare words only, no shared CTE).
create or replace function match_passages(
  q            text,                  -- normalized query text
  q_kind       text default null,     -- 'quran' | 'hadith' | null
  q_embedding  extensions.vector(1024) default null,
  k            int default 20,
  cv           text default null      -- corpus_version
)
returns table (id bigint, score double precision)
language sql stable
set search_path = public, extensions
-- Lower trigram threshold so a partial quote inside a long hadith still qualifies (default 0.6).
set pg_trgm.word_similarity_threshold = 0.4
as $$
  with params as (
    select
      to_tsquery('simple', array_to_string(tsvector_to_array(to_tsvector('simple', q)), ' | ')) as tsq
  ),
  base as (
    select p.* from passages p
    where (cv is null or p.corpus_version = cv)
      and (q_kind is null or p.kind = q_kind)
  ),
  fts as (
    select b.id, row_number() over (order by ts_rank_cd(b.fts, params.tsq) desc) as r
    from base b, params
    where b.fts @@ params.tsq
    order by ts_rank_cd(b.fts, params.tsq) desc
    limit 60
  ),
  trgm_ar as (
    select b.id, row_number() over (order by word_similarity(q, b.text_ar_norm) desc) as r
    from base b
    where q <% b.text_ar_norm
    order by word_similarity(q, b.text_ar_norm) desc
    limit 60
  ),
  trgm_en as (
    select b.id, row_number() over (order by word_similarity(q, b.text_en_norm) desc) as r
    from base b
    where b.text_en_norm is not null and q <% b.text_en_norm
    order by word_similarity(q, b.text_en_norm) desc
    limit 60
  ),
  vec as (
    select b.id, row_number() over (order by b.embedding <=> q_embedding) as r
    from base b
    where q_embedding is not null and b.embedding is not null
    order by b.embedding <=> q_embedding
    limit 60
  ),
  fused as (
    select id, 1.0 / (60 + r) as s from fts
    union all select id, 1.0 / (60 + r) from trgm_ar
    union all select id, 1.0 / (60 + r) from trgm_en
    union all select id, 1.0 / (60 + r) from vec
  )
  select id, sum(s)::double precision as score from fused group by id order by score desc limit k;
$$;

-- Row level security: the service connects with a server-side role; nothing is exposed to anon clients.
alter table sources enable row level security;
alter table corpus_versions enable row level security;
alter table passages enable row level security;
alter table llm_cache enable row level security;
alter table verification_runs enable row level security;

-- Only the service role calls the search function; not exposed through the public REST API.
revoke execute on function public.match_passages(text, text, extensions.vector, int, text) from public, anon, authenticated;
