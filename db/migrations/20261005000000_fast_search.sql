-- Faster candidate search (measured on 42,300 passages: 11-18 s -> 0.6-2.6 s per query, client in Riyadh,
-- database in Frankfurt).
--
-- 1. The full-text arm OR-ed every query word; common words (في، من، عن، الله، قال...) matched ~15,000 passages
--    and ranking them took ~8 s. It now uses only the 4 rarest query words found in under 3% of passages.
-- 2. A CTE shared by the four arms was materialized (a copy of the whole table per call). Each arm now filters
--    the table directly.
-- 3. The function no longer sets pg_trgm.word_similarity_threshold (not permitted on Supabase migrations); the
--    default 0.6 is used. Reworded quotes are still found through the rare-word full-text arm.
--
-- After loading a corpus, run: select refresh_lexeme_df();

create table if not exists lexeme_df (
  word  text primary key,
  ndoc  int not null
);
alter table lexeme_df enable row level security;

create or replace function refresh_lexeme_df() returns void
language sql
set search_path = public, extensions
as $$
  truncate lexeme_df;
  insert into lexeme_df (word, ndoc) select word, ndoc from ts_stat('select fts from public.passages');
$$;
revoke execute on function public.refresh_lexeme_df() from public, anon, authenticated;

drop function if exists public.match_passages(text, text, extensions.vector, int, text);

create function match_passages(
  q            text,
  q_kind       text default null,
  q_embedding  extensions.vector(1024) default null,
  k            int default 20,
  cv           text default null
)
returns table (id bigint, score double precision)
language sql stable
set search_path = public, extensions
as $$
  with rare as (
    select coalesce(
      (select to_tsquery('simple', string_agg(quote_literal(w.word), ' | '))
       from (
         select l.word from unnest(tsvector_to_array(to_tsvector('simple', q))) as t(word)
         join lexeme_df l on l.word = t.word
         where l.ndoc < (select greatest(1, count(*) * 0.03) from passages)
         order by l.ndoc asc
         limit 4
       ) w),
      to_tsquery('simple', '')
    ) as tsq
  ),
  fts as (
    select p.id, row_number() over (order by ts_rank_cd(p.fts, rare.tsq) desc) as r
    from passages p, rare
    where p.fts @@ rare.tsq
      and (cv is null or p.corpus_version = cv)
      and (q_kind is null or p.kind = q_kind)
    order by ts_rank_cd(p.fts, rare.tsq) desc
    limit 60
  ),
  trgm_ar as (
    select p.id, row_number() over (order by word_similarity(q, p.text_ar_norm) desc) as r
    from passages p
    where q <% p.text_ar_norm
      and (cv is null or p.corpus_version = cv)
      and (q_kind is null or p.kind = q_kind)
    order by word_similarity(q, p.text_ar_norm) desc
    limit 60
  ),
  trgm_en as (
    select p.id, row_number() over (order by word_similarity(q, p.text_en_norm) desc) as r
    from passages p
    where p.text_en_norm is not null and q <% p.text_en_norm
      and (cv is null or p.corpus_version = cv)
      and (q_kind is null or p.kind = q_kind)
    order by word_similarity(q, p.text_en_norm) desc
    limit 60
  ),
  vec as (
    select p.id, row_number() over (order by p.embedding <=> q_embedding) as r
    from passages p
    where q_embedding is not null and p.embedding is not null
      and (cv is null or p.corpus_version = cv)
      and (q_kind is null or p.kind = q_kind)
    order by p.embedding <=> q_embedding
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
revoke execute on function public.match_passages(text, text, extensions.vector, int, text) from public, anon, authenticated;
