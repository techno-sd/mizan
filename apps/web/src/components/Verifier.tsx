"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import CorrectedCopy from "@/components/CorrectedCopy";
import FindingResponse, { CopyButton, FindingEvidence } from "@/components/FindingResponse";
import ReviewReportButton from "@/components/ReviewReportButton";
import HighlightedText from "@/components/HighlightedText";
import { Book, Diff, ImageIcon, Paste, Plus, Repeat, ScaleLogo } from "@/components/Icons";
import { IMAGE_TYPES, imageFrom, shrinkImage } from "@/lib/image";
import { sortFindings } from "@/lib/labels";
import { reviewComment, reviewPlainText, verdict } from "@/lib/review-text";
import { buildCorrected, citation } from "@/lib/corrected";
import type { ReviewDecision, ReviewDecisions } from "@/lib/corrected";
import { SAMPLES, countQuotes, fmt } from "@/lib/sample";
import type { VerifyResponse } from "@/lib/types";

const MAX_CHARS = 20_000;

const ERRORS: Record<string, string> = {
  rate_limited: "تجاوزت عدد الفحوص المسموح به مؤقتًا. حاول بعد دقائق.",
  too_long: `النص أطول من الحد المسموح (${fmt(MAX_CHARS)} حرف).`,
  empty_text: "الصق نصًا أولًا.",
  upstream_unreachable: "تعذّر الاتصال بخدمة الفحص. أعد المحاولة بعد لحظات.",
  upstream_error: "حدث خطأ في خدمة الفحص. أعد المحاولة.",
};

const IMAGE_ERRORS: Record<string, string> = {
  rate_limited: "قرأت صورًا كثيرة في وقت قصير. حاول بعد دقائق.",
  image_too_large: "الصورة كبيرة جدًا. جرّب لقطة شاشة أصغر.",
  unsupported_image: "نقرأ صور PNG وJPEG وWebP فقط.",
  model_disabled: "قراءة الصور غير متاحة الآن. الصق النص بدلًا منها.",
  not_deployed: "خدمة قراءة الصور غير مفعّلة على الخادم بعد. الصق النص بدلًا منها.",
  upstream_error: "تعذّرت قراءة الصورة. جرّب صورة أوضح أو الصق النص.",
  upstream_unreachable: "تعذّر الاتصال بخدمة الفحص. أعد المحاولة بعد لحظات.",
};

// Shown while waiting; they follow the real order of the pipeline.
const STAGES = [
  { after: 0, text: "نكتشف الآيات والأحاديث في النص…" },
  { after: 1.5, text: "نبحث في القرآن الكريم وموسوعة الأحاديث النبوية…" },
  { after: 3.5, text: "نطابق الألفاظ ونتحقق من الإحالات…" },
];

function SendIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

function Composer({
  value,
  onChange,
  onSubmit,
  busy,
  large,
  focus,
  onImage,
  reading = false,
  notice,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  large?: boolean;
  focus?: boolean;
  onImage?: (file: File) => void;
  reading?: boolean;
  notice?: string | null;
}) {
  const tooLong = value.length > MAX_CHARS;
  const id = large ? "content" : "content-next";
  return (
    <>
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      onDragOver={(e) => { if (onImage) e.preventDefault(); }}
      onDrop={(e) => {
        const file = onImage && imageFrom(e.dataTransfer?.items);
        if (file) { e.preventDefault(); onImage(file); }
      }}
      className={`rounded-3xl border border-border bg-surface shadow-[var(--shadow)] transition focus-within:border-accent/60 focus-within:ring-4 focus-within:ring-accent/5 ${large ? "" : "flex items-end gap-1"}`}
    >
      <label htmlFor={id} className="sr-only">النص المراد فحصه</label>
      <textarea
        id={id}
        autoFocus={focus}
        dir={value.trim() ? "auto" : "rtl"}
        value={value}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        onPaste={(e) => {
          const file = onImage && imageFrom(e.clipboardData?.items);
          if (file) { e.preventDefault(); onImage(file); }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={reading ? "نقرأ النص من الصورة…" : large ? "الصق منشورًا أو مقالًا فيه آيات أو أحاديث، أو صورة منشور…" : "أرسل نصًا آخر أو صورة للفحص…"}
        className={`block w-full resize-none overflow-y-auto bg-transparent text-[1.05rem] leading-8 outline-none focus-visible:outline-none [field-sizing:content] placeholder:text-muted/80 disabled:opacity-60 ${
          large ? "max-h-[45vh] min-h-[140px] px-5 pt-5" : "max-h-[30vh] min-h-[48px] flex-1 px-4 py-2.5"
        }`}
      />
      <div className={large ? "flex items-center justify-between gap-3 px-3 pb-3" : "flex shrink-0 items-center gap-2 p-1.5"}>
        <span className={`px-2 text-xs ${tooLong ? "font-semibold text-[var(--orange-fg)]" : "text-muted"} ${!large && !value ? "hidden" : ""}`}>
          {value.length > 0 ? `${fmt(value.length)} / ${fmt(MAX_CHARS)}` : large ? `حتى ${fmt(MAX_CHARS)} حرف` : ""}
        </span>
        {onImage && (
          <label title="اقرأ النص من صورة أو لقطة شاشة" className={`inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-muted transition hover:bg-accent-soft hover:text-accent ${large ? "ms-auto px-3 text-sm" : "w-11"} ${busy || reading ? "pointer-events-none opacity-50" : ""}`}>
            {reading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" /> : <ImageIcon className="h-5 w-5" />}
            {large && <span>{reading ? "نقرأ الصورة…" : "صورة"}</span>}
            <input type="file" accept={IMAGE_TYPES.join(",")} className="sr-only" disabled={busy || reading} aria-label="اختر صورة لقراءة نصها"
              onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) onImage(file); }} />
          </label>
        )}
        <button
          type="submit"
          disabled={busy || reading || !value.trim() || tooLong}
          aria-label="افحص النص"
          title="افحص النص (Ctrl+Enter)"
          className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 bg-accent text-accent-contrast transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-border disabled:text-muted ${large ? "rounded-xl px-4 text-sm font-semibold" : "w-11 rounded-full"}`}
        >
          {busy ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
          ) : (
            <SendIcon className="h-5 w-5" />
          )}
          {large && <span>{busy ? "جارٍ الفحص" : "افحص النص"}</span>}
        </button>
      </div>
    </form>
    {notice && <p role="status" className="mt-2 px-2 text-xs leading-6 text-accent">{notice}</p>}
    </>
  );
}

type View = "findings" | "document" | "copy";
// The reply groups quotes by what the writer has to do.
const GROUPS: { key: string; title: string; tones: string[]; dot: string }[] = [
  { key: "fix", title: "تحتاج تصحيحًا", tones: ["fix"], dot: "bg-[var(--orange-fg)]" },
  { key: "review", title: "تحتاج تحققًا", tones: ["review"], dot: "bg-[var(--violet-fg)]" },
  { key: "neutral", title: "لم تُفحص", tones: ["neutral"], dot: "bg-[var(--zinc-fg)]" },
  { key: "ok", title: "مطابقة للمصدر", tones: ["ok"], dot: "bg-[var(--green-fg)]" },
];

const VIEWS = [
  { id: "findings" as const, label: "نتائج الفحص", Icon: Diff },
  { id: "document" as const, label: "النص الأصلي", Icon: Book },
  { id: "copy" as const, label: "النسخة المقترحة", Icon: Paste },
];

export default function Verifier() {
  const [draft, setDraft] = useState("");
  const [checkedText, setCheckedText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<View>("findings");
  const [editorOpen, setEditorOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [decisions, setDecisions] = useState<ReviewDecisions>({});
  const scrollViewport = useRef<HTMLDivElement>(null);
  const draftBeforeEdit = useRef("");
  const corrected = useMemo(() => buildCorrected(checkedText, result?.findings ?? [], decisions, "suggested"), [checkedText, result, decisions]);

  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - started) / 1000), 250);
    return () => clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    if (!activeId || (view !== "findings" && view !== "document")) return;
    const target = document.getElementById((view === "document" ? "mark-" : "finding-") + activeId);
    target?.focus({ preventScroll: true });
    const viewport = target?.closest<HTMLElement>("[data-review-scroll]");
    if (target && viewport) {
      const top = target.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop;
      viewport.scrollTo({ top: top - Math.max(16, (viewport.clientHeight - target.offsetHeight) / 2), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }, [activeId, view]);

  // A screenshot becomes text in the box; the writer reviews it, then checks it as usual.
  async function readImage(file: File) {
    if (reading || busy) return;
    setReading(true);
    setNotice(null);
    try {
      const image = await shrinkImage(file);
      const res = await fetch("/api/image-text", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(image) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setNotice(IMAGE_ERRORS[data.error] ?? IMAGE_ERRORS.upstream_error); return; }
      const text = String(data.text ?? "").trim();
      if (!text) { setNotice("لم نجد نصًا في هذه الصورة."); return; }
      setDraft((d) => (d.trim() ? d.trimEnd() + "\n\n" + text : text));
      setNotice("قرأنا النص من الصورة. راجعه وصحّح أي كلمة غير واضحة، ثم افحصه.");
    } catch {
      setNotice(IMAGE_ERRORS.upstream_error);
    } finally {
      setReading(false);
    }
  }

  async function verify() {
    const text = draft;
    if (!text.trim() || busy || text.length > MAX_CHARS) return;
    setBusy(true);
    setElapsed(0);
    setError(null);
    setNotice(null);
    setActiveId(null);
    setCheckedText(text);
    setResult(null);
    setEditorOpen(false);
    setView("findings");
    setDecisions({});
    requestAnimationFrame(() => scrollViewport.current?.scrollTo({ top: 0, behavior: "auto" }));
    const debug = new URLSearchParams(window.location.search).has("debug");
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, debug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(ERRORS[data.error] ?? ERRORS.upstream_error);
        return;
      }
      const next = data as VerifyResponse;
      setResult(next);
      setExpandedIds(new Set());
      setDraft("");
    } catch {
      setError(ERRORS.upstream_unreachable);
    } finally {
      setBusy(false);
    }
  }

  function toggleCard(id: string) {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectFromCard(id: string) {
    setActiveId(id);
    setView("document");
  }

  function selectFromText(id: string) {
    setActiveId(id);
    setView("findings");
  }

  function editText() {
    draftBeforeEdit.current = draft;
    setDraft(checkedText);
    setEditorOpen(true);
  }

  function cancelEdit() {
    setDraft(draftBeforeEdit.current);
    setEditorOpen(false);
  }

  function startNew() {
    setDraft("");
    setCheckedText("");
    setResult(null);
    setError(null);
    setEditorOpen(false);
    setActiveId(null);
    setDecisions({});
  }

  function decide(id: string, decision: ReviewDecision | null) {
    if (!corrected.proposals.some((p) => p.findingId === id) || decisions[id] === decision) return;
    setDecisions((previous) => {
      const next = { ...previous };
      if (decision) next[id] = decision;
      else delete next[id];
      return next;
    });
  }


  if (!checkedText) {
    return (
      <section aria-labelledby="hero-title" className="hero-section relative flex flex-1 items-center overflow-hidden">
        <div aria-hidden="true" className="hero-pattern pointer-events-none absolute inset-0" />
        <div className="relative mx-auto w-full max-w-3xl px-4 py-10 text-center sm:py-14">
          <span className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-accent text-accent-contrast shadow-[var(--shadow)]">
            <ScaleLogo className="h-6 w-6" />
          </span>
          <h1 id="hero-title" className="text-2xl font-bold leading-[1.6] sm:text-[2.1rem]">
            تحقّق من الآيات والأحاديث <span className="text-accent">قبل النشر</span>
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-[0.95rem] leading-7 text-muted">
            الصق نصك أو صورة منشور، ونطابق كل اقتباس مع مصدره ونريك الصواب.
          </p>
          <div className="mt-7 text-start">
            <Composer value={draft} onChange={setDraft} onSubmit={verify} busy={busy} onImage={readImage} reading={reading} notice={notice} large />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-muted">جرّب:</span>
            {SAMPLES.map((s) => <button key={s.id} type="button" title={s.hint} onClick={() => setDraft(s.text)} className="rounded-full border border-border bg-surface/80 px-3.5 py-1.5 text-xs text-muted transition hover:border-accent/50 hover:bg-accent-soft hover:text-accent">{s.label}</button>)}
          </div>
        </div>
      </section>
    );
  }

  const findings = result ? sortFindings(result.findings) : [];
  const comment = reviewComment(findings);
  // The header summary uses the reply's own groups, so its counts match the headings below.
  const summary = GROUPS.map((g) => ({ ...g, count: findings.filter((f) => g.tones.includes(verdict(f).tone)).length })).filter((g) => g.count);
  function jumpTo(key: string) {
    setView("findings");
    setTimeout(() => {
      const group = document.getElementById("group-" + key);
      if (!group) return;
      const fold = group.querySelector("details");
      if (fold) fold.open = true;
      const viewport = group.closest<HTMLElement>("[data-review-scroll]");
      // After the folded group has opened and laid out.
      requestAnimationFrame(() => viewport?.scrollTo({ top: viewport.scrollTop + group.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 12, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
    }, 0);
  }
  const stage = [...STAGES].reverse().find((s) => elapsed >= s.after) ?? STAGES[0];

  return (
    <div className="review-workspace mx-auto flex min-h-0 w-full max-w-[50rem] flex-1 flex-col gap-3 px-4 py-3 lg:max-w-[64rem] lg:px-6">
      <header className="review-heading flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold leading-7 sm:text-xl">مراجعة النص</h1>
          <div role="status" className="mt-1 text-xs leading-6 text-muted">
            {busy ? "نراجع اقتباساتك مقابل نصوص المصادر." : result
              ? findings.length ? <>
                <p className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                  <span className="me-1">{"وجدنا " + countQuotes(findings.length)}</span>
                  {summary.map((g) => <button key={g.key} type="button" onClick={() => jumpTo(g.key)} className="review-summary-item" aria-label={g.title + ": " + fmt(g.count) + "، انتقل إليها"}>
                    <span className={"h-2 w-2 rounded-full " + g.dot} aria-hidden="true" />{g.title}<strong>{fmt(g.count)}</strong>
                  </button>)}
                </p>
                <div className="review-summary-bar" aria-hidden="true">{summary.map((g) => <span key={g.key} className={g.dot} style={{ flexGrow: g.count }} />)}</div>
              </>
              : "لم نجد اقتباسات يمكن فحصها في هذا النص."
              : "لم يكتمل الفحص؛ يمكنك تعديل النص وإعادة المحاولة."}
          </div>
        </div>
        <div className="review-header-actions grid shrink-0 grid-cols-3 items-start gap-1.5 sm:flex">
          <button type="button" disabled={busy || editorOpen} onClick={editText} aria-label="تعديل وإعادة الفحص" title="تعديل النص وإعادة فحصه" className="review-action"><Repeat className="h-3.5 w-3.5" /><span>تعديل النص</span></button>
          {result && <ReviewReportButton text={checkedText} result={result} decisions={decisions} />}
          <button type="button" disabled={busy} onClick={startNew} className="review-action"><Plus className="h-3.5 w-3.5" /><span>نص جديد</span></button>
        </div>
      </header>

      {editorOpen && (
        <section aria-label="تعديل النص" className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain rounded-2xl border border-accent/25 bg-accent-soft/30 p-4">
          <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">عدّل النص ثم افحصه مرة أخرى</h2><button type="button" onClick={cancelEdit} className="review-button rounded-lg px-2 py-1 text-sm text-muted">إلغاء</button></div>
          <Composer value={draft} onChange={setDraft} onSubmit={verify} busy={busy} onImage={readImage} reading={reading} notice={notice} large focus />
        </section>
      )}

      {busy && (
        <div role="status" className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-5">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent/20 border-t-accent" aria-hidden="true" />
            <div><p className="font-semibold">{stage.text}</p><p className="mt-1 text-xs text-muted">قد يستغرق فحص النص بضع لحظات.</p></div>
          </div>
          <div aria-hidden="true" className="space-y-3">{[0, 1].map((n) => <div key={n} className="space-y-4 rounded-2xl border border-border bg-surface p-6"><div className="skeleton h-4 w-32" /><div className="skeleton h-6 w-3/4" /><div className="skeleton h-16 w-full" /></div>)}</div>
        </div>
      )}

      {error && !busy && <div role="alert" className="tone-orange rounded-xl px-4 py-4 text-sm leading-7">{error}<button type="button" onClick={editText} className="ms-3 font-semibold underline">تعديل النص والمحاولة مجددًا</button></div>}

      {result && !editorOpen && (
        <>
          <nav aria-label="أقسام المراجعة" className="review-tabs shrink-0">
            {VIEWS.map(({ id, label, Icon }) => <button key={id} type="button" aria-pressed={view === id} aria-controls="review-view" onClick={() => setView(id)} className={"review-button review-tab " + (view === id ? "review-tab-active" : "")}><Icon className="h-3.5 w-3.5" /><span>{label}</span></button>)}
          </nav>

          <div id="review-view" className="min-h-0 flex-1 overflow-hidden">
            {view === "findings" && (
              <section aria-label="نتائج الفحص" className="conversation-thread mx-auto w-full">
                <div ref={scrollViewport} data-review-scroll tabIndex={0} role="region" aria-label="المحادثة" className="conversation-scroll">
                <div className="conversation-response mx-auto max-w-[52rem]">
                  <div className="mb-5 flex items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-accent-contrast"><ScaleLogo className="h-5 w-5" /></span>
                    <div><h2 className="text-sm font-semibold">ميزان</h2><p className="text-xs text-muted">مراجعة الاقتباسات مع مصادرها</p></div>
                  </div>
                  <div className="response-comment mb-6 space-y-1.5">
                    <p className="text-base font-medium leading-8">{comment.overview}</p>
                    <p className="text-sm leading-7 text-muted">{comment.advice}</p>
                  </div>
                  {GROUPS.map((g) => {
                    const items = findings.filter((f) => g.tones.includes(verdict(f).tone));
                    if (!items.length) return null;
                    const list = <ul className="response-findings list-none space-y-5">
                      {items.map((f) => {
                        const number = result.findings.findIndex((item) => item.id === f.id) + 1;
                        return <FindingResponse key={result.run_id + f.id} finding={f} originalText={checkedText} active={activeId === f.id} number={number} expanded={expandedIds.has(f.id)} onSource={() => toggleCard(f.id)} onOriginal={() => selectFromCard(f.id)}>
                          <FindingEvidence finding={f} number={number} />
                        </FindingResponse>;
                      })}
                    </ul>;
                    const heading = <span className="response-group-title"><span className={"h-2 w-2 rounded-full " + g.dot} aria-hidden="true" />{g.title}<span className="text-muted">{" (" + fmt(items.length) + ")"}</span></span>;
                    // Correct quotes fold away when something else needs the writer.
                    const fold = g.key === "ok" && findings.some((f) => verdict(f).tone !== "ok");
                    return <section key={g.key} id={"group-" + g.key} aria-label={g.title} className="response-group">
                      {fold ? <details className="response-group-fold"><summary>{heading}<span className="ms-auto text-xs font-normal text-muted">عرض</span></summary><div className="mt-4">{list}</div></details>
                        : <><h3 className="mb-3">{heading}</h3>{list}</>}
                    </section>;
                  })}
                  {findings.some((f) => f.evidence.length) && <section aria-label="المصادر" className="response-sources">
                    <h3 className="response-group-title mb-2">المصادر</h3>
                    <ol className="space-y-1.5 text-sm leading-7">
                      {result.findings.map((f, i) => {
                        const ev = f.evidence[0];
                        if (!ev) return null;
                        return <li key={f.id} className="flex gap-2">
                          <span className="quote-number">{fmt(i + 1)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="font-medium">{ev.collection === "quran" || ev.collection === "hadeethenc" ? citation(ev) : ev.reference}</span>
                            <span className="text-muted"> · {ev.collection === "hadeethenc" ? "موسوعة الأحاديث النبوية، رقم " + ev.number : ev.source_label.replace(/\s*\([A-Za-z-]+\)$/, "")}</span>
                            <span className={"ms-1.5 text-xs " + (ev.source_approved ? "text-[var(--green-fg)]" : "text-[var(--amber-fg)]")}>{ev.source_approved ? "ضمن الحزمة العلمية" : "خارج الحزمة العلمية"}</span>
                            {ev.url && /^https?:\/\//i.test(ev.url) && <a href={ev.url} target="_blank" rel="noopener noreferrer" className="ms-2 text-xs text-accent underline">فتح</a>}
                          </span>
                        </li>;
                      })}
                    </ol>
                  </section>}
                  {findings.length > 0 && <p className="mt-5 text-xs leading-6 text-muted">مطابقة اللفظ لا تعني صحة الحديث. الأحكام المذكورة منقولة من مصادرها.</p>}
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {findings.length > 0 && <CopyButton text={reviewPlainText(result.findings, checkedText)} label="نسخ الرد" />}
                    {corrected.proposals.length > 0 && <button type="button" onClick={() => setView("copy")} className="review-button inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent-soft"><Paste className="h-4 w-4" />النص المقترح</button>}
                  </div>
                  {!findings.length && <ReviewScope result={result} />}
                </div>
                </div>
                <div className="conversation-composer"><Composer value={draft} onChange={setDraft} onSubmit={verify} busy={busy} onImage={readImage} reading={reading} notice={notice} /></div>
              </section>
            )}
            {view === "document" && (
              <div ref={scrollViewport} data-review-scroll tabIndex={0} role="region" aria-label="النص المفحوص" className="review-tab-scroll">
              <section className="review-document rounded-2xl border border-border bg-surface p-5 sm:p-8">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4"><div><h2 className="font-semibold">النص الذي فحصته</h2><p className="mt-1 text-xs text-muted">نظلّل موضع المشكلة؛ اختره للاطّلاع على التفاصيل.</p></div><span className="text-xs text-muted">{fmt(checkedText.length)} حرف</span></div>
                <HighlightedText text={checkedText} findings={result.findings} activeId={activeId} onSelect={selectFromText} />
              </section>
              <ReviewScope result={result} />
              </div>
            )}
            {view === "copy" && <div ref={scrollViewport} data-review-scroll tabIndex={0} role="region" aria-label="النسخة المقترحة" className="review-tab-scroll">{(findings.some((f) => f.span)
              ? <CorrectedCopy key={result.run_id} text={checkedText} findings={result.findings} decisions={decisions} onDecision={decide} onReset={() => setDecisions({})} />
              : <div className="rounded-2xl border border-border bg-surface p-8 text-center text-muted">لا توجد تصحيحات مقترحة لهذا النص.</div>)}<ReviewScope result={result} /></div>}
          </div>

        </>
      )}
    </div>
  );
}

function ReviewScope({ result }: { result: VerifyResponse }) {
  return <div className="mt-4 space-y-3">
    <details className="rounded-xl border border-border/70 px-4 py-3 text-xs text-muted">
      <summary className="cursor-pointer font-medium">المصادر المستخدمة ونطاق الفحص</summary>
      <p className="mt-3 leading-7">{result.corpus_scope.map((scope) => scope.replace("مصدر إضافي غير مدرج في الحزمة العلمية", "خارج الحزمة العلمية")).join("، ")}</p>
      <p className="mt-2">نسخة المصادر {result.corpus_version}{!result.llm_used && " · الفحص بالقواعد فقط"}</p>
    </details>
    {result.trace && <details className="rounded-xl border border-border p-3 text-xs" dir="ltr"><summary className="cursor-pointer">trace</summary><pre className="mt-2 overflow-x-auto">{JSON.stringify(result.trace, null, 2)}</pre></details>}
  </div>;
}
