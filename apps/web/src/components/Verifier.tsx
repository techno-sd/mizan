"use client";

import { useEffect, useState } from "react";

import FindingCard from "@/components/FindingCard";
import HighlightedText from "@/components/HighlightedText";
import { STATUS, STATUS_ORDER, sortFindings } from "@/lib/labels";
import { SAMPLE_TEXT } from "@/lib/sample";
import type { VerifyResponse } from "@/lib/types";

const ERRORS: Record<string, string> = {
  rate_limited: "تجاوزت عدد الطلبات المسموح به مؤقتًا. حاول بعد دقائق.",
  too_long: "النص أطول من الحد المسموح (20,000 حرف).",
  empty_text: "الصق نصًا أولًا.",
  upstream_unreachable: "تعذّر الاتصال بخدمة الفحص. قد تكون في طور التشغيل؛ أعد المحاولة بعد لحظات.",
  upstream_error: "حدث خطأ في خدمة الفحص.",
};

export default function Verifier() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [checkedText, setCheckedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500);
    return () => clearInterval(t);
  }, [loading]);

  async function verify() {
    setLoading(true);
    setElapsed(0);
    setError(null);
    setActiveId(null);
    // Add ?debug to the page URL to get the pipeline trace (candidates, scores, rules fired).
    const debug = new URLSearchParams(window.location.search).has("debug");
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, debug }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(ERRORS[data.error] ?? "حدث خطأ غير متوقع.");
        return;
      }
      setResult(data as VerifyResponse);
      setCheckedText(text);
    } catch {
      setError(ERRORS.upstream_unreachable);
    } finally {
      setLoading(false);
    }
  }

  function select(id: string) {
    setActiveId(id);
    document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const findings = result ? sortFindings(result.findings) : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section className="space-y-3">
        {result && checkedText === text ? (
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-semibold">النص المفحوص</h2>
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1 text-sm hover:bg-surface-muted"
                onClick={() => setCheckedText("")}
              >
                تعديل النص
              </button>
            </div>
            <HighlightedText text={text} findings={result.findings} activeId={activeId} onSelect={select} />
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface p-5">
            <label htmlFor="content" className="mb-2 block font-semibold">
              الصق المحتوى المراد فحصه
            </label>
            <textarea
              id="content"
              dir="auto"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="نص مقال أو منشور أو سكربت فيديو يحتوي آيات أو أحاديث أو أقوالًا منسوبة…"
              className="min-h-[320px] w-full resize-y rounded-lg border border-border bg-background p-3 leading-8 outline-none focus:border-accent"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={loading || !text.trim()}
                onClick={verify}
                className="rounded-lg bg-accent px-5 py-2 font-semibold text-accent-contrast disabled:opacity-50"
              >
                {loading ? `جارٍ الفحص… ${elapsed} ث` : "افحص المحتوى"}
              </button>
              <button
                type="button"
                onClick={() => setText(SAMPLE_TEXT)}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-muted"
              >
                جرّب نصًا تجريبيًا
              </button>
              <span className="text-xs text-muted">{text.length.toLocaleString("ar")} حرف</span>
            </div>
          </div>
        )}
        {error && <p className="rounded-lg tone-orange p-3 text-sm">{error}</p>}
      </section>

      <section className="space-y-3">
        {!result && !loading && (
          <div className="rounded-xl border border-dashed border-border p-6 text-sm leading-7 text-muted">
            <p className="mb-2 font-semibold text-foreground">ماذا يفحص ميزان؟</p>
            <ul className="list-inside list-disc space-y-1">
              <li>هل الآية أو الحديث موجود بلفظه في المصادر؟ ويعرض الفرق إن اختلف اللفظ.</li>
              <li>هل الإحالة صحيحة (السورة والآية، أو كتاب الحديث)؟ ويقترح الإحالة الصحيحة.</li>
              <li>ما أحكام العلماء المنقولة على الحديث، منسوبة إلى أصحابها.</li>
              <li>وإذا لم يجد النص قال ذلك بوضوح، دون أن يخترع مصدرًا.</li>
            </ul>
          </div>
        )}

        {result && (
          <>
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{result.summary.total} اقتباسًا</span>
                {STATUS_ORDER.filter((s) => result.summary.by_status[s]).map((s) => (
                  <span key={s} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[s].tone}`}>
                    {STATUS[s].label}: {result.summary.by_status[s]}
                  </span>
                ))}
                {result.summary.needs_scholar_review > 0 && (
                  <span className="tone-violet rounded-full px-2.5 py-0.5 text-xs font-medium">
                    يُحال لمختص: {result.summary.needs_scholar_review}
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs leading-5 text-muted">
                تم الفحص مقابل: {result.corpus_scope.join("، ")} · نسخة المصادر {result.corpus_version}
                {!result.llm_used && " · وضع القواعد فقط"}
              </p>
            </div>

            {findings.length === 0 && (
              <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
                لم نجد آيات أو أحاديث أو أقوالًا منسوبة في هذا النص.
              </p>
            )}
            {findings.map((f) => (
              <FindingCard key={f.id} finding={f} active={activeId === f.id} onSelect={() => setActiveId(f.id)} />
            ))}

            {result.trace && (
              <details className="rounded-xl border border-border bg-surface p-3 text-xs" dir="ltr">
                <summary className="cursor-pointer">trace</summary>
                <pre className="mt-2 overflow-x-auto">{JSON.stringify(result.trace, null, 2)}</pre>
              </details>
            )}
          </>
        )}
      </section>
    </div>
  );
}
