"use client";

import { useState } from "react";

import { GRADE_TONE, STATUS, TYPE_LABEL, gradingSummary } from "@/lib/labels";
import type { DiffOp, Evidence, Finding, Span } from "@/lib/types";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-muted"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "تم النسخ" : label}
    </button>
  );
}

function DiffView({ diff }: { diff: DiffOp[] }) {
  return (
    <div>
      <p className="source-text" dir="auto">
        {diff.map((d, i) => (
          <span key={i}>
            {i > 0 ? " " : ""}
            <span className={d.op === "insert" ? "diff-insert" : d.op === "delete" ? "diff-delete" : ""}>{d.text}</span>
          </span>
        ))}
      </p>
      <p className="mt-1 text-xs text-muted">
        <span className="diff-insert">مشطوب</span> = في نصك وليس في المصدر ·{" "}
        <span className="diff-delete">مظلّل</span> = في المصدر وليس في نصك
      </p>
    </div>
  );
}

function sourceWording(diff: DiffOp[]): string {
  return diff.filter((d) => d.op !== "insert").map((d) => d.text).join(" ");
}

const EXCERPT_PAD = 160;

// Source text with the matched part highlighted. Long texts (a hadith with its full isnad) collapse to an
// excerpt around the match; the full text is one click away so nothing is ever shown out of context.
function MarkedText({ text, span, open, className }: { text: string; span: Span | null; open: boolean; className: string }) {
  if (!span) return <p className={`${className} ${!open && text.length > 420 ? "line-clamp-4" : ""}`}>{text}</p>;
  const from = open ? 0 : Math.max(0, span.start - EXCERPT_PAD);
  const to = open ? text.length : Math.min(text.length, span.end + EXCERPT_PAD);
  return (
    <p className={className}>
      {from > 0 && "… "}
      {text.slice(from, span.start)}
      <mark className="mark-green rounded px-0.5 text-inherit">{text.slice(span.start, span.end)}</mark>
      {text.slice(span.end, to)}
      {to < text.length && " …"}
    </p>
  );
}

function EvidenceBlock({ ev, showEnglish }: { ev: Evidence; showEnglish: boolean }) {
  const [open, setOpen] = useState(false);
  const arSpan = ev.highlight_lang === "ar" ? ev.highlight : null;
  const enSpan = ev.highlight_lang === "en" ? ev.highlight : null;
  const long = ev.text.length > 420 || (!!arSpan && ev.text.length > arSpan.end - arSpan.start + 2 * EXCERPT_PAD);
  return (
    <div className="rounded-lg border border-border bg-surface-muted p-3">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{ev.reference}</span>
        {ev.numbering_scheme && ev.collection !== "quran" && (
          <span className="text-xs text-muted">({ev.numbering_scheme})</span>
        )}
        {ev.url && (
          <a className="text-xs text-accent underline" href={ev.url} target="_blank" rel="noreferrer">
            افتح المصدر
          </a>
        )}
      </div>
      {ev.context_before && <p className="source-text text-muted">{ev.context_before}</p>}
      <MarkedText text={ev.text} span={arSpan} open={open} className="source-text" />
      {ev.context_after && <p className="source-text text-muted">{ev.context_after}</p>}
      {long && (
        <button type="button" className="mt-1 text-xs text-accent underline" onClick={() => setOpen(!open)}>
          {open ? "عرض أقل" : "عرض النص كاملًا"}
        </button>
      )}
      {(showEnglish || enSpan) && ev.text_en && (
        <div dir="ltr" className="mt-2">
          <MarkedText text={ev.text_en} span={enSpan} open={open} className="text-sm leading-6 text-muted" />
        </div>
      )}
    </div>
  );
}

export default function FindingCard({
  finding: f,
  active,
  onSelect,
}: {
  finding: Finding;
  active: boolean;
  onSelect: () => void;
}) {
  const st = STATUS[f.status];
  const grading = gradingSummary(f);
  const changed = f.diff.some((d) => d.op !== "equal");
  const showEnglish = /[a-z]/i.test(f.quoted_text);
  const [showNearest, setShowNearest] = useState(false);

  return (
    <article
      id={`card-${f.id}`}
      onClick={onSelect}
      className={`rounded-xl border bg-surface p-4 shadow-sm transition ${
        active ? "border-accent ring-1 ring-accent" : "border-border"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${st.tone}`}>{st.label}</span>
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted">{TYPE_LABEL[f.type]}</span>
        {grading && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${grading.tone}`}>{grading.label}</span>
        )}
        {f.needs_scholar_review && (
          <span className="tone-violet rounded-full px-2 py-0.5 text-xs font-medium">يُحال لمختص</span>
        )}
      </div>

      <p className="mb-1 text-xs text-muted">ما كتبته{f.cited_reference ? ` · الإحالة المذكورة: ${f.cited_reference}` : ""}</p>
      <p dir="auto" className="mb-3 leading-8">
        «{f.quoted_text}»
      </p>

      <p className="mb-3 text-sm text-muted">{st.hint}</p>

      {changed && (
        <section className="mb-3">
          <h4 className="mb-1 text-sm font-semibold">الفرق بين نصك والمصدر</h4>
          <DiffView diff={f.diff} />
          <div className="mt-2">
            <CopyButton text={sourceWording(f.diff)} label="انسخ لفظ المصدر" />
          </div>
        </section>
      )}

      {f.evidence.length > 0 && (
        <section className="mb-3 space-y-2">
          <h4 className="text-sm font-semibold">الدليل من المصدر</h4>
          <EvidenceBlock ev={f.evidence[0]} showEnglish={showEnglish} />
          {f.evidence.length > 1 && (
            <p className="text-xs text-muted">ورد أيضًا في: {f.evidence.slice(1).map((e) => e.reference).join("، ")}</p>
          )}
        </section>
      )}

      {f.suggested_reference && f.status !== "matches_source" && (
        <section className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span>الإحالة الصحيحة:</span>
          <span className="font-semibold">{f.suggested_reference}</span>
          <CopyButton text={f.suggested_reference} label="انسخ الإحالة" />
        </section>
      )}

      {f.gradings.length > 0 && (
        <section className="mb-3">
          <h4 className="mb-1 text-sm font-semibold">أحكام العلماء المنقولة</h4>
          <ul className="space-y-0.5 text-sm">
            {f.gradings.map((g, i) => (
              <li key={i}>
                <span>{g.scholar_ar ?? g.scholar}: </span>
                <span className={`font-semibold ${GRADE_TONE[g.category]}`}>{g.grade_ar ?? g.grade}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted">منقولة كما وردت في المصدر؛ ميزان لا يصدر أحكامًا على الأحاديث.</p>
        </section>
      )}

      {f.evidence.some((e) => e.collection === "bukhari" || e.collection === "muslim") && f.gradings.length === 0 && (
        <p className="mb-3 text-sm">ورد في {f.evidence.find((e) => e.collection === "bukhari" || e.collection === "muslim")!.collection_label}.</p>
      )}

      {[...f.review_reasons, ...f.notes].length > 0 && (
        <ul className="mb-2 list-inside list-disc space-y-1 text-sm text-muted">
          {[...f.review_reasons, ...f.notes].map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}

      {f.nearest && (
        <div className="mt-2">
          <button type="button" className="text-xs text-accent underline" onClick={() => setShowNearest(!showNearest)}>
            {showNearest ? "إخفاء أقرب نص" : "أقرب نص في المصادر (نص مختلف)"}
          </button>
          {showNearest && (
            <div className="mt-2">
              <p className="mb-1 text-xs text-muted">
                هذا نص مختلف عمّا كتبته، وليس تصحيحًا له. يُعرض للمقارنة فقط.
              </p>
              <EvidenceBlock ev={f.nearest} showEnglish={showEnglish} />
            </div>
          )}
        </div>
      )}
    </article>
  );
}
