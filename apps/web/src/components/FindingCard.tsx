"use client";

import { useState } from "react";

import Feedback from "@/components/Feedback";
import { Alert, Check, Chevron, Copy, External, Search } from "@/components/Icons";
import { citation } from "@/lib/corrected";
import { GRADE_TONE, STATUS, gradingSummary, startsExpanded } from "@/lib/labels";
import type { DiffOp, Evidence, Finding, Grading, ReferenceStatus, Span } from "@/lib/types";

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
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-sm hover:bg-surface-muted"
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

const clean = (ref: string) => ref.replace(/^[\s[(«]+|[\s\])»]+$/g, "");

// One plain sentence: what is wrong (or right) with this quote.
function verdict(f: Finding, ev: Evidence | undefined): string {
  const cited = f.cited_reference ? clean(f.cited_reference) : null;
  const isVerse = ev?.collection === "quran";
  switch (f.status) {
    case "matches_source":
      return cited ? "النص منقول بلفظه، والإحالة صحيحة." : "النص منقول بلفظه. لم تذكر إحالة؛ أضفها من الأسفل.";
    case "reference_mismatch":
      if (ev && f.type === "quran" && !isVerse) return "هذا حديث نبوي وليس آية من القرآن.";
      if (ev && f.type === "hadith" && isVerse) return "هذا النص آية من القرآن وليس حديثًا.";
      return cited ? `الإحالة غير صحيحة: ذكرتَ «${cited}».` : "النص موجود، لكن في موضع غير الذي ذُكر.";
    case "wording_differs":
      return "النص موجود في المصدر، لكن لفظك يختلف عنه.";
    case "not_found":
      return "لم نجد هذا النص في المصادر. هذا لا يعني أنه موضوع، لكن لا تنسبه قبل التحقق منه.";
    default:
      return f.type === "attributed_quote"
        ? "الأقوال المنسوبة لغير النبي ﷺ لا تفحصها هذه النسخة."
        : "هذا النوع من النصوص لا تفحصه هذه النسخة.";
  }
}

// Your words vs. the source's words, as two lines (no legend needed).
function Wording({ diff }: { diff: DiffOp[] }) {
  const line = (keep: DiffOp["op"], cls: string) =>
    diff.filter((d) => d.op === "equal" || d.op === keep).map((d, i) => (
      <span key={i}>
        {i > 0 ? " " : ""}
        <span className={d.op === keep ? cls : ""}>{d.text}</span>
      </span>
    ));
  return (
    <div className="space-y-2 text-[1.02rem] leading-8">
      <p dir="auto"><span className="me-2 text-sm text-muted">ما كتبته:</span>{line("insert", "diff-insert")}</p>
      <p dir="auto" className="source-text"><span className="me-2 font-sans text-sm text-muted">لفظ المصدر:</span>{line("delete", "diff-delete")}</p>
    </div>
  );
}

const sourceWords = (diff: DiffOp[]) => diff.filter((d) => d.op !== "insert").map((d) => d.text).join(" ");

const EXCERPT_PAD = 160;
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

// The source passage in full, for whoever wants to check it (inside "details").
function SourcePassage({ ev, showEnglish }: { ev: Evidence; showEnglish: boolean }) {
  const [open, setOpen] = useState(false);
  const arSpan = ev.highlight_lang === "ar" ? ev.highlight : null;
  const enSpan = ev.highlight_lang === "en" ? ev.highlight : null;
  const long = ev.text.length > 420 || (!!arSpan && ev.text.length > arSpan.end - arSpan.start + 2 * EXCERPT_PAD);
  return (
    <div className="rounded-xl bg-surface-muted p-4">
      {ev.context_before && <p className="source-text text-muted">{ev.context_before}</p>}
      <MarkedText text={ev.text} span={arSpan} open={open} className="source-text" />
      {ev.context_after && <p className="source-text text-muted">{ev.context_after}</p>}
      {long && (
        <button type="button" className="mt-1 text-sm font-medium text-accent hover:underline" onClick={() => setOpen(!open)}>
          {open ? "عرض أقل" : "النص كاملًا مع سنده"}
        </button>
      )}
      {(showEnglish || enSpan) && ev.text_en && (
        <div dir="ltr" className="mt-3 border-t border-border pt-3">
          <MarkedText text={ev.text_en} span={enSpan} open={open} className="text-sm leading-6 text-muted" />
        </div>
      )}
    </div>
  );
}

// "موسوعة الأحاديث النبوية، رقم 4309" / "البقرة: 256 · موسوعة القرآن الكريم" / "سنن ابن ماجه 224 · مجموعة hadith-api".
function sourceLine(ev: Evidence): string {
  const label = ev.source_label.replace(/\s*\([A-Za-z-]+\)$/, "");
  return ev.collection === "hadeethenc" ? `${label}، رقم ${ev.number}` : `${ev.reference} · ${label}`;
}

// The ruling shown first: the approved source's, otherwise the first one reported.
const mainGrading = (gs: Grading[]) => gs.find((g) => g.source_approved) ?? gs[0];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm leading-7">
      <span className="w-14 shrink-0 text-muted">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

export default function FindingCard({
  finding: f,
  runId,
  active,
  onSelect,
}: {
  finding: Finding;
  runId: string;
  active: boolean;
  onSelect: () => void;
}) {
  const [open, setOpen] = useState(() => startsExpanded(f));
  const [details, setDetails] = useState(false);
  const expanded = open || active;
  const st = STATUS[f.status];
  const Icon = STATUS_ICON[f.status];
  const grading = gradingSummary(f);
  const ev = f.evidence[0];
  const changed = f.diff.some((d) => d.op !== "equal");
  const showEnglish = /[a-z]/i.test(f.quoted_text);
  const fixRef = ev && (f.status === "reference_mismatch" || (f.status === "matches_source" && !f.cited_reference)) ? citation(ev) : null;
  const g = f.gradings.length ? mainGrading(f.gradings) : null;
  const bodyId = `card-body-${f.id}`;

  return (
    <article id={`card-${f.id}`} className={`card overflow-hidden transition ${active ? "ring-2 ring-accent" : ""}`}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={() => {
          onSelect();
          setOpen(!expanded);
        }}
        className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-surface-muted/60"
      >
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${st.tone}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{st.label}</span>
            {grading && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${grading.tone}`}>{grading.short}</span>}
          </span>
          <span dir="auto" className="mt-0.5 block truncate text-sm text-muted">«{f.quoted_text}»</span>
        </span>
        <Chevron className={`h-5 w-5 shrink-0 text-muted transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div id={bodyId} className="space-y-4 border-t border-border px-4 pb-4 pt-4">
          <p className="leading-8">{verdict(f, ev)}</p>

          {changed && (
            <div className="space-y-3 rounded-xl border border-border p-4">
              <Wording diff={f.diff} />
              <CopyButton text={sourceWords(f.diff)} label="نسخ لفظ المصدر" />
            </div>
          )}

          {fixRef && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-accent-soft px-4 py-3">
              <span className="text-sm text-muted">{f.status === "reference_mismatch" ? "الصحيح" : "الإحالة"}</span>
              <span className="font-bold text-accent">{fixRef}</span>
              <span className="ms-auto"><CopyButton text={fixRef} label="نسخ" /></span>
            </div>
          )}

          {(ev || g || f.needs_scholar_review) && (
            <div className="space-y-1.5">
              {g && (
                <Row label="الحكم">
                  <span className={`font-semibold ${GRADE_TONE[g.category]}`}>{g.grade_ar ?? g.grade}</span>
                  <span className="text-muted"> — {g.scholar_ar ?? g.scholar}</span>
                  {grading && <span className="text-muted"> · {grading.label}</span>}
                  {f.gradings.length > 1 && <span className="text-muted"> · كل الأحكام ({f.gradings.length}) في التفاصيل</span>}
                </Row>
              )}
              {ev && (
                <Row label="المصدر">
                  <span className="font-medium">{sourceLine(ev)}</span>
                  <span className={`ms-2 rounded-full px-2 py-0.5 text-xs ${ev.source_approved ? "tone-green" : "tone-amber"}`}>
                    {ev.source_approved ? "معتمد" : "غير مدرج في الحزمة العلمية"}
                  </span>
                  {ev.url && (
                    <a href={ev.url} target="_blank" rel="noreferrer" className="ms-2 inline-flex items-center gap-1 text-accent hover:underline">
                      فتح <External className="h-3.5 w-3.5" />
                    </a>
                  )}
                </Row>
              )}
              {f.needs_scholar_review && (
                <Row label="تنبيه">
                  <span className="tone-violet rounded px-1.5 py-0.5">يُستحسن عرضه على مختص</span>
                  <span className="text-muted"> — {f.review_reasons.join("؛ ") || "النتيجة غير قاطعة"}</span>
                </Row>
              )}
            </div>
          )}

          {(ev || f.nearest || f.notes.length > 0) && (
            <div>
              <button
                type="button"
                aria-expanded={details}
                onClick={() => setDetails(!details)}
                className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
              >
                {details ? "إخفاء التفاصيل" : "التفاصيل"}
                <Chevron className={`h-4 w-4 transition-transform ${details ? "rotate-180" : ""}`} />
              </button>
              {details && (
                <div className="mt-3 space-y-4">
                  {ev && <SourcePassage ev={ev} showEnglish={showEnglish} />}
                  {f.evidence.length > 1 && (
                    <p className="text-sm leading-7 text-muted">ورد أيضًا في: {f.evidence.slice(1).map((e) => e.reference).join("، ")}</p>
                  )}
                  {f.gradings.length > 1 && (
                    <div>
                      <h4 className="mb-1 text-sm font-semibold">الأحكام المنقولة</h4>
                      <ul className="divide-y divide-border rounded-xl border border-border text-sm">
                        {f.gradings.map((x, i) => (
                          <li key={i} className="flex items-center justify-between gap-3 px-3 py-1.5">
                            <span>
                              {x.scholar_ar ?? x.scholar}
                              {!x.source_approved && <span className="ms-2 text-xs text-muted">عبر {x.source_label}</span>}
                            </span>
                            <span className={`font-semibold ${GRADE_TONE[x.category]}`}>{x.grade_ar ?? x.grade}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1 text-xs text-muted">منقولة كما وردت في مصادرها؛ ميزان لا يحكم على الأحاديث.</p>
                    </div>
                  )}
                  {ev?.takhrij && (
                    <div>
                      <h4 className="mb-1 text-sm font-semibold">التخريج</h4>
                      <p className="whitespace-pre-line text-sm leading-7 text-muted">{ev.takhrij}</p>
                    </div>
                  )}
                  {f.notes.length > 0 && (
                    <ul className="space-y-1 text-sm leading-7 text-muted">
                      {f.notes.map((n, i) => <li key={i}>• {n}</li>)}
                    </ul>
                  )}
                  {f.nearest && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted">أقرب نص في المصادر (نص مختلف، للمقارنة فقط — {f.nearest.reference}):</p>
                      <SourcePassage ev={f.nearest} showEnglish={showEnglish} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <Feedback runId={runId} finding={f} />
        </div>
      )}
    </article>
  );
}
