-- Readers' reports on results ("this is right" / "this is wrong"), queued for a specialist.
-- Holds the reported quote and the reader's comment only, never the rest of the checked text.

create table if not exists feedback (
  id                  bigint generated always as identity primary key,
  created_at          timestamptz not null default now(),
  run_id              text not null,
  finding_id          text not null,
  verdict             text not null check (verdict in ('correct', 'wrong')),
  status              text,                -- the status Mizan gave
  quoted_text         text not null default '',
  suggested_reference text,
  comment             text not null default '',
  corpus_version      text,
  pipeline_version    text,
  -- Specialist workflow: new -> confirmed (Mizan was wrong) / rejected (Mizan was right) -> fixed.
  review_state        text not null default 'new' check (review_state in ('new', 'confirmed', 'rejected', 'fixed')),
  reviewer_note       text
);

create index if not exists feedback_queue_idx on feedback (created_at desc) where review_state = 'new';
alter table feedback enable row level security;
