"use client";

import { useEffect, useRef, useState } from "react";

import { Book, Check, Chevron, Copy, External, Paste } from "@/components/Icons";
import { GRADE_TONE, gradingSummary } from "@/lib/labels";
import { gradingSentence, referenceChange, referenceLabel, reviewCorrection, reviewOriginal, reviewText, verdict, wordingChange } from "@/lib/review-text";
import { toUtf16Span } from "@/lib/spans";
import { evidenceReference } from "@/lib/references";
import type { Evidence, Finding, Grading, Span } from "@/lib/types";

export function CopyButton({ text, label, primary = false }: { text: string; label: string; primary?: boolean }) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <button
      type="button"
      className={"review-button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm " + (primary ? "border-accent bg-accent text-accent-contrast hover:bg-accent-hover" : "border-border bg-surface hover:bg-surface-muted")}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          setState("done");
        } catch {
          setState("error");
        }
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setState("idle"), 2000);
      }}
    >
      {state === "done" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      <span aria-live="polite">{state === "done" ? "تم النسخ" : state === "error" ? "تعذّر النسخ" : label}</span>
    </button>
  );
}

const EXCERPT_PAD = 80;
function MarkedText({ text, span, open, className, quran = false }: { text: string; span: Span | null; open: boolean; className: string; quran?: boolean }) {
  span = toUtf16Span(text, span);
  const brackets = quran && !text.trim().startsWith("﴿");
  if (!span) return <p className={`${className} ${!open && text.length > 420 ? "line-clamp-4" : ""}`}>{brackets && "﴿"}{text}{brackets && "﴾"}</p>;
  const from = open ? 0 : Math.max(0, span.start - EXCERPT_PAD);
  const to = open ? text.length : Math.min(text.length, span.end + EXCERPT_PAD);
  return (
    <p className={className}>
      {brackets && "﴿"}
      {from > 0 && "… "}
      {text.slice(from, span.start)}
      <mark className="mark-green rounded px-0.5 text-inherit">{text.slice(span.start, span.end)}</mark>
      {text.slice(span.end, to)}
      {to < text.length && " …"}
      {brackets && "﴾"}
    </p>
  );
}

// The source passage in full, for whoever wants to check it (inside "details").
function SourcePassage({ ev, showEnglish }: { ev: Evidence; showEnglish: boolean }) {
  const [open, setOpen] = useState(false);
  const arSpan = ev.highlight_lang === "ar" ? ev.highlight : null;
  const enSpan = ev.highlight_lang === "en" ? ev.highlight : null;
  const long = ev.text.length > 420 || !!ev.context_before || !!ev.context_after || (!!arSpan && ev.text.length > arSpan.end - arSpan.start + 2 * EXCERPT_PAD);
  return (
    <div className="evidence-passage">
      {(arSpan || enSpan) && <p className="mb-2 text-[11px] leading-5 text-muted">المقطع المقارَن مظلّل بالأخضر</p>}
      {open && ev.context_before && <p className="source-text mb-2 text-muted">{ev.context_before}</p>}
      <MarkedText text={ev.text} span={arSpan} open={open} className="source-text" quran={ev.collection === "quran"} />
      {open && ev.context_after && <p className="source-text mt-2 text-muted">{ev.context_after}</p>}
      {long && (
        <button type="button" aria-expanded={open} className="review-button mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline" onClick={() => setOpen(!open)}>
          {open ? "اختصار النص" : "عرض السياق كاملًا"}<Chevron className={"h-3.5 w-3.5 transition " + (open ? "rotate-180" : "")} />
        </button>
      )}
      {(showEnglish || enSpan) && ev.text_en && (
        <div dir={ev.translation_lang === "ur" ? "rtl" : "ltr"} className="mt-3 border-t border-border pt-3">
{ev.translation_label && <p dir="rtl" className="mb-1 text-xs text-muted">{ev.translation_label}</p>}
<MarkedText text={ev.text_en} span={enSpan} open={open} className="text-sm leading-6 text-muted" />
        </div>
      )}
    </div>
  );
}

// "موسوعة الأحاديث النبوية، رقم 4309" / "البقرة: 256 · موسوعة القرآن الكريم" / "سنن ابن ماجه 224 · مجموعة hadith-api".
function sourceLine(ev: Evidence): string {
  const label = ev.source_label.replace(/\s*\([A-Za-z-]+\)$/, "");
  return ev.collection === "hadeethenc" ? `${label}، رقم ${ev.number}` : `${evidenceReference(ev)} · ${label}`;
}

// The ruling shown first: the approved source's, otherwise the first one reported.
const mainGrading = (gs: Grading[]) => gs.find((g) => g.source_approved) ?? gs[0];

export default function FindingResponse({ finding: f, originalText, active, number, expanded, onSource, onOriginal, children }: {
  finding: Finding; originalText: string; active: boolean; number: number;
  expanded: boolean; onSource: () => void; onOriginal: () => void; children?: React.ReactNode;
}) {
  const ev = f.evidence[0];
  const message = reviewText(f);
  const original = reviewOriginal(f, originalText);
  const correction = reviewCorrection(f);
  const g = f.gradings.length ? mainGrading(f.gradings) : null;
  const grading = gradingSummary(f);
  const sourceUrl = ev?.url && /^https?:\/\//i.test(ev.url) ? ev.url : null;
  const emphasis = ["يحتاج مراجعة", "مطابق للنص", "مطابق لترجمة", "صحّح الإحالة", "اللفظ في المصدر", "لم نجده", "خارج نطاق", "الأقوال المنسوبة"].find((phrase) => message.text.startsWith(phrase));
  const v = verdict(f);
  const detail = referenceChange(f) ?? (f.status === "wording_differs" && message.tone === "fix" ? wordingChange(f.diff) : null);
  const gradeLine = gradingSentence(f);
  const highlightTone = f.status === "not_found" ? "neutral" : message.tone;
  return (
    <li id={"finding-" + f.id} tabIndex={-1} aria-label={"الاقتباس " + number} data-status={f.status} className={"finding-response " + (active ? "finding-response-active" : "")}>
      <p className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <span className="quote-number" aria-label={"الاقتباس " + number}>{number}</span>
        <span className={"verdict-badge verdict-" + v.tone}>{v.label}</span>
        {grading && <span className="verdict-badge verdict-review">{grading.short}</span>}
        <span>في نصّك:</span>
      </p>
      <p dir="auto" className="response-quotation">
        <span className={"font-medium text-foreground " + (f.type === "quran" ? "font-naskh text-xl" : "")}>{original.segments.map((segment, index) => segment.issue
          ? <mark key={index} className="response-original-issue response-highlight response-highlight-fix">{segment.text}</mark>
          : <span key={index}>{segment.text}</span>)}</span>
      </p>
      {detail && <p dir="auto" className="response-explanation">{detail}</p>}
      {correction && <p dir="auto" className="response-correction"><span className="font-semibold">الصحيح: </span><span>{correction}</span>{sourceUrl && <SourceCitation url={sourceUrl} number={number} evidence={ev!} />}</p>}
      {(!correction || gradeLine) && <p dir="auto" className="response-explanation">
        {!correction && <>{emphasis ? <><mark className={"response-highlight response-highlight-" + highlightTone}>{emphasis}</mark><span>{message.text.slice(emphasis.length)}</span></> : <span>{message.text}</span>}
        {message.reference && <><span>{message.tone === "fix" && f.status === "reference_mismatch" ? " " : referenceLabel(f, message.tone) + ": "}</span><span className={"font-medium " + (message.tone === "review" ? "text-foreground" : "text-accent")}>{message.reference}</span><span>.</span></>}
        {sourceUrl && <SourceCitation url={sourceUrl} number={number} evidence={ev!} />}</>}
        {gradeLine && <span className={grading ? "text-muted" : g ? GRADE_TONE[g.category] : ""}> {gradeLine}</span>}
      </p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button id={"source-" + f.id} type="button" onClick={onSource} aria-label={"المصدر والتفاصيل للاقتباس " + number} aria-expanded={expanded} aria-controls={"evidence-" + f.id} className={"review-button inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-accent transition hover:border-accent/30 hover:bg-accent-soft " + (expanded ? "border-accent/30 bg-accent-soft" : "border-border bg-surface")}><Book className="h-3.5 w-3.5" />{ev ? "المصدر والتفاصيل" : "تفاصيل الفحص"}<Chevron className={"h-3 w-3 transition " + (expanded ? "rotate-180" : "")} /></button>
        {f.span && <button type="button" onClick={onOriginal} aria-label={"موضع الاقتباس " + number + " في النص الأصلي"} aria-controls="review-view" className="review-button inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted transition hover:bg-surface-muted hover:text-foreground"><Paste className="h-3.5 w-3.5" />النص الأصلي</button>}
      </div>
      {expanded && children}
    </li>
  );
}

function SourceCitation({ url, number, evidence }: { url: string; number: number; evidence: Evidence }) {
  return <a href={url} target="_blank" rel="noopener noreferrer" className="inline-citation" aria-label={"المصدر " + number + ": " + evidenceReference(evidence) + "، فتح في نافذة جديدة"} title={evidenceReference(evidence)}>{number}</a>;
}

function SourceEvidence({ evidence: e, showEnglish, primary = false }: { evidence: Evidence; showEnglish: boolean; primary?: boolean }) {
  return <section aria-label={primary ? "الدليل من المصدر" : "مصدر آخر"} className="space-y-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0"><h4 className="inline-flex items-center gap-1.5 text-xs font-semibold"><Book className="h-3.5 w-3.5" />{primary ? "النص في المصدر" : e.collection_label}</h4><p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-6 text-muted">{!primary && <span>{sourceLine(e)}</span>}<span className={"source-scope " + (e.source_approved ? "source-scope-approved" : "source-scope-extra")}>{e.source_approved ? "من الحزمة العلمية" : "مصدر إضافي خارج الحزمة العلمية"}</span></p></div>
      {e.url && /^https?:\/\//i.test(e.url) && <a href={e.url} target="_blank" rel="noopener noreferrer" className="review-button inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent-soft">فتح المصدر<External className="h-3.5 w-3.5" /></a>}
    </div>
    <SourcePassage ev={e} showEnglish={showEnglish} />
    {e.takhrij && <details className="evidence-disclosure"><summary>التخريج من المصدر</summary><p className="mt-2 whitespace-pre-line text-xs leading-7 text-muted">{e.takhrij}</p></details>}
  </section>;
}

function ReportedGradings({ gradings, title, withReference = false }: { gradings: Grading[]; title: string; withReference?: boolean }) {
  if (!gradings.length) return null;
  return <section aria-label={title} className="evidence-gradings"><h4 className="mb-3 text-xs font-semibold">{title}</h4><ul className="space-y-3">{gradings.map((g, i) => <li key={i}><p className="text-sm leading-7"><span>{g.scholar_ar ?? g.scholar}: </span><strong className={GRADE_TONE[g.category]}>{g.grade_ar ?? g.grade}</strong></p>{(g.reference || g.source_label) && <p className="text-xs leading-5 text-muted">{[withReference && g.reference, g.source_label].filter(Boolean).join(" · ")}{!g.source_approved && " · خارج الحزمة العلمية"}</p>}</li>)}</ul><p className="mt-3 text-[11px] leading-5 text-muted">أحكام منقولة؛ مطابقة النص لا تعني صحة الحديث.</p></section>;
}

export function FindingEvidence({
  finding: f, number,
}: {
  finding: Finding; number: number;
}) {
  const [otherSourcesOpen, setOtherSourcesOpen] = useState(false);
  const ev = f.evidence[0];
  const otherSources = f.evidence.slice(1);
  // A ruling belongs to the passage it was reported on: a grade on Ibn Majah's chain is not a grade on Muslim's.
  const primaryGradings = ev ? f.gradings.filter((g) => g.reference ? g.reference === ev.reference
    : g.source_label !== null && g.source_label === ev.source_label && g.source_approved === ev.source_approved) : [];
  const otherGradings = f.gradings.filter((g) => !primaryGradings.includes(g));
  const showEnglish = /[a-z]/i.test(f.quoted_text);
  const bodyId = "evidence-" + f.id;
  const label = ev ? evidenceReference(ev) : f.status === "out_of_scope" ? "خارج نطاق الفحص" : "لم يتوفر مصدر";
  const review = f.needs_scholar_review || gradingSummary(f) !== null;
  return (
    <section id={bodyId} aria-label={"تفاصيل الاقتباس " + number} className="response-inline-details">
      <div className="source-entry-heading">
        <span className="source-number">{number}</span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold leading-6">{label}</span><span className="mt-0.5 block text-xs leading-5 text-muted">{ev ? ev.source_label.replace(/\s*\([A-Za-z-]+\)$/, "") : f.quoted_text}</span></span>
        {review && <span className="verdict-badge verdict-review shrink-0">تحتاج مراجعة</span>}
      </div>
      <div className="response-evidence space-y-5">
        {f.needs_scholar_review && <p className="review-note"><strong>للمراجعة: </strong>{f.review_reasons.join("؛ ") || "النتيجة غير قاطعة وتحتاج مراجعة مختص."}</p>}
        {!ev && <p className="rounded-lg bg-surface-muted px-3 py-3 text-sm leading-7 text-muted">{reviewText(f).text}</p>}
        {ev && <SourceEvidence evidence={ev} showEnglish={showEnglish} primary />}
        <ReportedGradings gradings={primaryGradings} title="الحكم المنقول في المصدر" />
        {(otherSources.length > 0 || otherGradings.length > 0) && <div>
          <button type="button" aria-label={"مصادر أخرى للاقتباس " + number} aria-expanded={otherSourcesOpen} aria-controls={"other-sources-" + f.id} onClick={() => setOtherSourcesOpen((open) => !open)} className="review-button inline-flex items-center gap-1.5 rounded-lg border border-[var(--details-border)] bg-surface px-3 py-1.5 text-xs font-medium text-accent hover:bg-[var(--details-header)]"><Book className="h-3.5 w-3.5" />{otherSourcesOpen ? "إخفاء المصادر الأخرى" : "عرض مصادر أخرى"}<Chevron className={"h-3 w-3 transition " + (otherSourcesOpen ? "rotate-180" : "")} /></button>
          {otherSourcesOpen && <div id={"other-sources-" + f.id} role="region" aria-label={"مصادر أخرى للاقتباس " + number} className="mt-4 space-y-5 border-t border-[var(--details-border)] pt-4">
            {otherSources.map((e, i) => <SourceEvidence key={e.passage_id + ":" + i} evidence={e} showEnglish={showEnglish} />)}
            <ReportedGradings gradings={otherGradings} title="أحكام منقولة على روايات أخرى" withReference />
          </div>}
        </div>}
        {f.nearest && <details className="evidence-disclosure"><summary>نص قريب للمقارنة فقط</summary><div className="mt-3 space-y-2"><p className="text-xs text-muted">{evidenceReference(f.nearest)} · ليس دليلًا على صحة الاقتباس</p><SourcePassage ev={f.nearest} showEnglish={showEnglish} /></div></details>}
      </div>
    </section>
  );
}
