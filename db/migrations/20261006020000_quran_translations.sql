-- Approved translations of the meanings of the Quran (QuranEnc), one row per ayah and language, so a verse quoted
-- in French, Urdu, Turkish... can be compared word for word with the approved translation in that language.

create table if not exists quran_translations (
  lang            text not null,          -- en, fr, es, de, id, tr, ur
  sura            int  not null,
  aya             int  not null,
  translation_key text not null,          -- QuranEnc key, e.g. french_rashid
  text            text not null,          -- as published, footnote markers removed
  text_norm       text not null,          -- normalized for search
  primary key (lang, sura, aya)
);

create index if not exists quran_translations_trgm_idx on quran_translations using gin (text_norm extensions.gin_trgm_ops);
alter table quran_translations enable row level security;

-- Ayat whose translation in language l contains the quote (trigram word similarity), best first.
create or replace function match_translation(q text, l text, k int default 5)
returns table (sura int, aya int, text text, translation_key text, score real)
language sql stable
set search_path = public, extensions
as $$
  select t.sura, t.aya, t.text, t.translation_key, word_similarity(q, t.text_norm) as score
  from quran_translations t
  where t.lang = l and q <% t.text_norm
  order by score desc
  limit k;
$$;
revoke execute on function public.match_translation(text, text, int) from public, anon, authenticated;
