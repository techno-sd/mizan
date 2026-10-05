"use client";

import { useState } from "react";

import { Alert, Check, Chevron, Copy, External, Search } from "@/components/Icons";
import { GRADE_TONE, STATUS, TYPE_LABEL, gradingSummary, startsExpanded } from "@/lib/labels";
import type { DiffOp, Evidence, Finding, ReferenceStatus, Span } from "@/lib/types";

const STATUS_ICON: Record<ReferenceStatus, (p: { className?: string }) => React.ReactNode> = {
  matches_source: Check,
  wording_differs: Alert,
  reference_mismatch: Alert,
  not_found: Search,
  out_of_scope: Search,
};

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-sm hover:bg-surface-muted"
      onClick={async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
      <span aria-live="polite">{done ? "تم النسخ" : label}</span>
    </button>
  );
}

function sourceWording(diff: DiffOp[]): string {
  return diff.filter((d) => d.op !== "insert").map((d) => d.text).join(" ");
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
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span><span className="diff-insert">مشطوب</span> في نصك وليس في المصدر</span>
        <span><span className="diff-delete">مظلّل</span> في المصدر وليس في نصك</span>
      </p>
    </div>
  );
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

// Every piece of evidence names where it comes from; supplementary (non-package) sources are marked as such.
function SourceBadge({ label, url, approved }: { label: string; url?: string; approved: boolean }) {
  const text = approved ? "مصدر معتمد" : "مصدر إضافي غير مدرج في الحزمة العلمية";
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted">المصدر:</span>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
          {label}
        </a>
      ) : (
        <span className="font-medium">{label}</span>
      )}
      <span className={`rounded-full px-2 py-0.5 ${approved ? "tone-green" : "tone-amber"}`}>{text}</span>
    </span>
  );
}

function EvidenceBlock({ ev, showEnglish, label }: { ev: Evidence; showEnglish: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  const arSpan = ev.highlight_lang === "ar" ? ev.highlight : null;
  const enSpan = ev.highlight_lang === "en" ? ev.highlight : null;
  const long = ev.text.length > 420 || (!!arSpan && ev.text.length > arSpan.end - arSpan.start + 2 * EXCERPT_PAD);
  return (
    <figure className="rounded-xl border border-border bg-surface-muted p-4">
      <figcaption className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {label && <span className="text-muted">{label}</span>}
        <span className="font-semibold">{ev.reference}</span>
        {ev.numbering_scheme && ev.collection !== "quran" && <span className="text-xs text-muted">{ev.numbering_scheme}</span>}
        {ev.url && (
          <a
            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            href={ev.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            افتح المصدر <External className="h-3.5 w-3.5" />
          </a>
        )}
      </figcaption>
      <div className="mb-2">
        <SourceBadge label={ev.source_label} url={ev.source_url} approved={ev.source_approved} />
      </div>
      {ev.context_before && <p className="source-text text-muted">{ev.context_before}</p>}
      <MarkedText text={ev.text} span={arSpan} open={open} className="source-text" />
      {ev.context_after && <p className="source-text text-muted">{ev.context_after}</p>}
      {long && (
        <button
          type="button"
          className="mt-1 text-sm font-medium text-accent hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
        >
          {open ? "عرض أقل" : "عرض النص كاملًا مع سنده"}
        </button>
      )}
      {ev.takhrij && (
        <details className="mt-3 border-t border-border pt-3 text-sm" onClick={(e) => e.stopPropagation()}>
          <summary className="cursor-pointer font-medium text-accent">التخريج من المصدر المعتمد</summary>
          <p className="mt-2 whitespace-pre-line leading-7 text-muted">{ev.takhrij}</p>
        </details>
      )}
      {(showEnglish || enSpan) && ev.text_en && (
        <div dir="ltr" className="mt-3 border-t border-border pt-3">
          <MarkedText text={ev.text_en} span={enSpan} open={open} className="text-sm leading-6 text-muted" />
        </div>
      )}
    </figure>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold text-muted">{title}</h4>
      {children}
    </section>
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
  const [open, setOpen] = useState(() => startsExpanded(f));
  const expanded = open || active;
  const st = STATUS[f.status];
  const Icon = STATUS_ICON[f.status];
  const grading = gradingSummary(f);
  const changed = f.diff.some((d) => d.op !== "equal");
  const showEnglish = /[a-z]/i.test(f.quoted_text);
  const [showNearest, setShowNearest] = useState(false);
  const bodyId = `card-body-${f.id}`;

  return (
    <article
      id={`card-${f.id}`}
      className={`card overflow-hidden transition ${active ? "ring-2 ring-accent" : ""}`}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={() => {
          onSelect();
          setOpen(!expanded);
        }}
        className="flex w-full items-start gap-3 p-4 text-start hover:bg-surface-muted/60"
      >
        <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${st.tone}`}>
          <Icon className="h-4.5 w-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{st.label}</span>
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted">{TYPE_LABEL[f.type]}</span>
            {grading && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${grading.tone}`}>{grading.label}</span>}
            {f.needs_scholar_review && <span className="tone-violet rounded-full px-2 py-0.5 text-xs font-semibold">يُحال لمختص</span>}
          </span>
          <span dir="auto" className={`mt-1 block text-[0.97rem] leading-7 ${expanded ? "" : "truncate text-muted"}`}>
            «{f.quoted_text}»
          </span>
        </span>
        <Chevron className={`mt-1 h-5 w-5 text-muted transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div id={bodyId} className="space-y-5 border-t border-border px-4 pb-5 pt-4">
          <p className="leading-7">
            {st.hint}
            {f.cited_reference && (
              <span className="text-muted">
                {" "}الإحالة التي ذكرتها: «{f.cited_reference.replace(/^[\s[(«]+|[\s\])»]+$/g, "")}».
              </span>
            )}
          </p>

          {f.suggested_reference && f.status !== "matches_source" && f.status !== "out_of_scope" && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-accent-soft px-4 py-3">
              <span className="text-sm text-muted">الإحالة الصحيحة</span>
              <span className="font-bold text-accent">{f.suggested_reference}</span>
              <span className="ms-auto">
                <CopyButton text={f.suggested_reference} label="نسخ الإحالة" />
              </span>
            </div>
          )}

          {changed && (
            <Section title="الفرق بين نصك والمصدر">
              <DiffView diff={f.diff} />
              <CopyButton text={sourceWording(f.diff)} label="نسخ لفظ المصدر" />
            </Section>
          )}

          {f.evidence.length > 0 && (
            <Section title="الدليل من المصدر">
              <EvidenceBlock ev={f.evidence[0]} showEnglish={showEnglish} />
              {f.evidence.length > 1 && (
                <p className="text-sm text-muted">ورد أيضًا في: {f.evidence.slice(1).map((e) => e.reference).join("، ")}</p>
              )}
            </Section>
          )}

          {f.gradings.length > 0 && (
            <Section title="الحكم المنقول">
              <ul className="divide-y divide-border rounded-xl border border-border">
                {f.gradings.map((g, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-4 py-2">
                    <span>
                      {g.scholar_ar ?? g.scholar}
                      {g.source_label && g.source_label !== g.scholar && (
                        <span className="ms-2 text-xs text-muted">
                          عبر {g.source_label}
                          {!g.source_approved && " (غير مدرج في الحزمة العلمية)"}
                        </span>
                      )}
                    </span>
                    <span className={`font-semibold ${GRADE_TONE[g.category]}`}>{g.grade_ar ?? g.grade}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">منقول كما ورد في مصدره المذكور؛ ميزان لا يصدر أحكامًا على الأحاديث.</p>
            </Section>
          )}

          {[...f.review_reasons, ...f.notes].length > 0 && (
            <ul className="space-y-1.5 rounded-xl bg-surface-muted px-4 py-3 text-sm leading-7 text-muted">
              {[...f.review_reasons, ...f.notes].map((n, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden="true">•</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          )}

          {f.nearest && (
            <div>
              <button
                type="button"
                className="text-sm font-medium text-accent hover:underline"
                onClick={() => setShowNearest(!showNearest)}
                aria-expanded={showNearest}
              >
                {showNearest ? "إخفاء أقرب نص" : "عرض أقرب نص في المصادر (نص مختلف)"}
              </button>
              {showNearest && (
                <div className="mt-2 space-y-2">
                  <p className="text-sm text-muted">هذا نص مختلف عمّا كتبته، وليس تصحيحًا له؛ يُعرض للمقارنة فقط.</p>
                  <EvidenceBlock ev={f.nearest} showEnglish={showEnglish} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
