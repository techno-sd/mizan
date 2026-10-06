import type { CorrectionProposal, ReviewDecision } from "@/lib/corrected";

export default function CorrectionDecision({ proposal, decision, onDecision, comparison = true }: {
  proposal: CorrectionProposal;
  decision?: ReviewDecision;
  onDecision: (decision: ReviewDecision | null) => void;
  comparison?: boolean;
}) {
  const included = decision !== "keep";
  return (
    <section aria-label="خيارات الاقتراح" className="space-y-3 rounded-xl border border-border p-4">
      <label className="flex cursor-pointer items-center justify-between gap-4 text-sm font-medium">
        <span>تضمين هذا الاقتراح في النص<span className="mt-1 block text-xs font-normal text-muted">{included ? "يظهر لفظ المصدر أو إحالته في النسخة المقترحة" : "يظهر النص الأصلي دون هذا التعديل"}</span></span>
        <input type="checkbox" checked={included} onChange={(e) => onDecision(e.target.checked ? "approve" : "keep")} className="h-5 w-5 shrink-0 accent-accent" />
      </label>
      {comparison && proposal.changes.map((change, i) => (
        <div key={i} className="grid gap-2 border-t border-border pt-3 text-sm sm:grid-cols-2">
          <div className="min-w-0"><p className="mb-1 text-xs text-muted">الأصل</p><p dir="auto" className="break-words leading-7">{change.before || "بلا إحالة"}</p></div>
          <div className="min-w-0"><p className="mb-1 text-xs text-accent">المقترح من المصدر</p><p dir="auto" className="break-words leading-7">{change.after}</p></div>
        </div>
      ))}
    </section>
  );
}
