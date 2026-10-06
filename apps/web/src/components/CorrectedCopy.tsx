"use client";

import { useMemo } from "react";
import CorrectionDecision from "@/components/CorrectionDecision";
import { CopyButton } from "@/components/FindingResponse";
import { External } from "@/components/Icons";
import { buildCorrected } from "@/lib/corrected";
import type { ReviewDecision, ReviewDecisions } from "@/lib/corrected";
import type { Finding } from "@/lib/types";

export default function CorrectedCopy({ text, findings, decisions, onDecision, onReset }: {
  text: string; findings: Finding[]; decisions: ReviewDecisions;
  onDecision: (id: string, decision: ReviewDecision | null) => void;
  onReset: () => void;
}) {
  const c = useMemo(() => buildCorrected(text, findings, decisions, "suggested"), [text, findings, decisions]);
  const included = c.proposals.filter((p) => decisions[p.findingId] !== "keep").length;
  return (
    <section aria-label="النص المقترح" className="review-copy overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-5 sm:px-7">
        <div><h2 className="text-lg font-semibold">النص المقترح</h2><p className="mt-1 text-xs leading-6 text-muted">الاقتراحات المضمّنة: {included} · راجع النص قبل النشر.</p></div>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={c.text} label="نسخ النص" primary />
          <CopyButton text={c.plain} label="نسخ مع المصادر" />
        </div>
      </div>
      <div className="space-y-5 p-5 sm:p-7">
        {c.flagged > 0 && <aside className="tone-amber rounded-xl px-4 py-3 text-sm leading-7"><strong>مواضع تحتاج انتباهك: {c.flagged}.</strong> تبقى الحالات غير القاطعة دون تصحيح تلقائي، وتُعرض ملاحظاتها مع المصادر أدناه.</aside>}
        <div dir="auto" className="whitespace-pre-wrap break-words text-[1.05rem] leading-[2.2]" aria-label="محتوى النص المقترح">{c.text}</div>
        {c.proposals.length > 0 && <details className="rounded-xl border border-border">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">عرض التعديلات المقترحة ({c.proposals.length})</summary>
          <div className="space-y-3 border-t border-border p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted"><p>ألغِ تحديد أي اقتراح للإبقاء على الأصل.</p><button type="button" onClick={onReset} disabled={!Object.keys(decisions).length} className="review-button rounded-lg px-2 py-1 hover:bg-surface-muted disabled:opacity-40">استعادة كل الاقتراحات</button></div>
            {c.proposals.map((proposal) => <div key={proposal.findingId}><p className="mb-2 text-xs font-semibold text-muted">الاقتباس {findings.findIndex((f) => f.id === proposal.findingId) + 1}</p><CorrectionDecision proposal={proposal} decision={decisions[proposal.findingId]} onDecision={(decision) => onDecision(proposal.findingId, decision)} /></div>)}
          </div>
        </details>}
        {c.notes.length > 0 && <details className="rounded-xl border border-border">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">المصادر والملاحظات ({c.notes.length})</summary>
          <ol className="space-y-3 border-t border-border p-4 text-sm leading-7">
            {c.notes.map((n) => <li key={n.n} className={`rounded-lg p-3 ${n.warn ? "tone-amber" : "bg-surface-muted/50"}`}>
              <p className="font-semibold">الاقتباس {findings.findIndex((f) => f.id === n.findingId) + 1}</p>
              <p>{n.lines.join(" · ")}</p>
              {n.url && <a href={n.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-accent underline">فتح المصدر <External className="h-3.5 w-3.5" /></a>}
            </li>)}
          </ol>
        </details>}
      </div>
    </section>
  );
}
