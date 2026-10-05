"use client";

import { useEffect, useRef, useState } from "react";

import CorrectedCopy from "@/components/CorrectedCopy";
import FindingCard from "@/components/FindingCard";
import HighlightedText from "@/components/HighlightedText";
import { ScaleLogo } from "@/components/Icons";
import { sortFindings } from "@/lib/labels";
import type { Finding } from "@/lib/types";
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
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  large?: boolean;
}) {
  const tooLong = value.length > MAX_CHARS;
  const id = large ? "content" : "content-next";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="rounded-3xl border border-border bg-surface shadow-[var(--shadow)] transition focus-within:border-accent/60"
    >
      <label htmlFor={id} className="sr-only">
        النص المراد فحصه
      </label>
      <textarea
        id={id}
        dir="auto"
        value={value}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={large ? "الصق مقالًا أو منشورًا فيه آيات أو أحاديث…" : "الصق نصًا جديدًا للفحص…"}
        className={`block w-full resize-none overflow-y-auto bg-transparent px-5 pt-4 text-[1.05rem] leading-8 outline-none [field-sizing:content] placeholder:text-muted/80 disabled:opacity-60 ${
          large ? "max-h-[45vh] min-h-[120px]" : "max-h-[30vh] min-h-[56px]"
        }`}
      />
      <div className="flex items-center justify-between gap-3 px-3 pb-3">
        <span className={`px-2 text-xs ${tooLong ? "font-semibold text-[var(--orange-fg)]" : "text-muted"}`}>
          {value.length > 0 && `${fmt(value.length)} / ${fmt(MAX_CHARS)}`}
        </span>
        <button
          type="submit"
          disabled={busy || !value.trim() || tooLong}
          aria-label="افحص النص"
          title="افحص النص (Ctrl+Enter)"
          className="grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-contrast transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-border disabled:text-muted"
        >
          {busy ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
          ) : (
            <SendIcon className="h-5 w-5" />
          )}
        </button>
      </div>
    </form>
  );
}

// One summary line under the results: how many quotes are fine and how many need the writer.
const SUMMARY: { label: string; dot: string; test: (f: Finding) => boolean }[] = [
  { label: "مطابقة للمصدر", dot: "bg-[var(--green-fg)]", test: (f) => f.status === "matches_source" },
  { label: "تحتاج تصحيحًا", dot: "bg-[var(--orange-fg)]", test: (f) => f.status === "reference_mismatch" || f.status === "wording_differs" },
  { label: "لم نجدها في المصادر", dot: "bg-[var(--slate-fg)]", test: (f) => f.status === "not_found" },
  { label: "لم تُفحص", dot: "bg-[var(--zinc-fg)]", test: (f) => f.status === "out_of_scope" },
];

export default function Verifier() {
  const [draft, setDraft] = useState("");
  const [checkedText, setCheckedText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    const t = setInterval(() => setElapsed((Date.now() - started) / 1000), 250);
    return () => clearInterval(t);
  }, [busy]);

  async function verify() {
    const text = draft;
    if (!text.trim() || busy || text.length > MAX_CHARS) return;
    setBusy(true);
    setElapsed(0);
    setError(null);
    setActiveId(null);
    setCheckedText(text);
    setResult(null);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    // Add ?debug to the page URL to get the pipeline trace (candidates, scores, rules fired).
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
      setResult(data as VerifyResponse);
      setDraft("");
    } catch {
      setError(ERRORS.upstream_unreachable);
    } finally {
      setBusy(false);
    }
  }

  function selectFromCard(id: string) {
    setActiveId(id);
    document.getElementById(`mark-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function selectFromText(id: string) {
    setActiveId(id);
    requestAnimationFrame(() => document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  // ---------- Empty state: centered heading and composer ----------
  if (!checkedText) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent">
            <ScaleLogo className="h-6 w-6" />
          </span>
          <h1 className="text-2xl font-bold sm:text-3xl">تحقّق من الآيات والأحاديث قبل أن تنشر</h1>
          <p className="mt-2 text-muted">يطابق كل اقتباس مع المصادر المعتمدة، ويريك الفرق والإحالة الصحيحة والحكم.</p>
        </div>
        <Composer value={draft} onChange={setDraft} onSubmit={verify} busy={busy} large />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              type="button"
              title={s.hint}
              onClick={() => setDraft(s.text)}
              className="rounded-full border border-border px-3.5 py-1.5 text-sm text-muted transition hover:border-accent/50 hover:text-foreground"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---------- Conversation view: checked text, results, composer pinned at the bottom ----------
  const findings = result ? sortFindings(result.findings) : [];
  const stage = [...STAGES].reverse().find((s) => elapsed >= s.after) ?? STAGES[0];

  return (
    <div className="flex flex-1 flex-col">
      <div ref={topRef} className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 pb-6 pt-6" aria-live="polite">
        {/* The checked text, shown like the user's message */}
        <section aria-label="النص المفحوص" className="rounded-3xl bg-surface-muted px-5 py-4">
          {result ? (
            <HighlightedText text={checkedText} findings={result.findings} activeId={activeId} onSelect={selectFromText} />
          ) : (
            <p dir="auto" className="line-clamp-6 whitespace-pre-wrap leading-8">
              {checkedText}
            </p>
          )}
        </section>

        {busy && (
          <div className="flex items-center gap-3 px-1 text-muted">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />
            {stage.text}
          </div>
        )}

        {error && !busy && (
          <p role="alert" className="tone-orange rounded-xl px-4 py-3 text-sm">
            {error}
          </p>
        )}

        {result && (
          <>
            <div className="space-y-1 px-1">
              <p className="text-lg font-semibold">
                {findings.length === 0 ? "لم نجد آيات أو أحاديث أو أقوالًا منسوبة في هذا النص." : `وجدنا ${countQuotes(findings.length)}`}
              </p>
              {findings.length > 0 && (
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {SUMMARY.map((x) => {
                    const n = findings.filter(x.test).length;
                    return n ? (
                      <span key={x.label} className="inline-flex items-center gap-1.5">
                        <span className={`h-2.5 w-2.5 rounded-full ${x.dot}`} aria-hidden="true" />
                        {n} {x.label}
                      </span>
                    ) : null;
                  })}
                </p>
              )}
            </div>

            {findings.length > 0 && <CorrectedCopy text={checkedText} findings={result.findings} />}

            <div className="space-y-3">
              {findings.map((f) => (
                <FindingCard key={f.id} finding={f} runId={result.run_id} active={activeId === f.id} onSelect={() => selectFromCard(f.id)} />
              ))}
            </div>

            <p className="px-1 text-xs leading-6 text-muted">
              تم الفحص مقابل: {result.corpus_scope.join("، ")} · نسخة المصادر {result.corpus_version}
              {!result.llm_used && " · وضع القواعد فقط"}
            </p>

            {result.trace && (
              <details className="rounded-xl border border-border p-3 text-xs" dir="ltr">
                <summary className="cursor-pointer">trace</summary>
                <pre className="mt-2 overflow-x-auto">{JSON.stringify(result.trace, null, 2)}</pre>
              </details>
            )}
          </>
        )}
      </div>

      {/* Composer pinned to the bottom for the next check */}
      <div className="sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent pt-6">
        <div className="mx-auto w-full max-w-3xl px-4 pb-3">
          <Composer value={draft} onChange={setDraft} onSubmit={verify} busy={busy} />
        </div>
      </div>
    </div>
  );
}
