"use client";

import { useState } from "react";

import type { Finding } from "@/lib/types";

type State = "idle" | "comment" | "sending" | "sent" | "error";

// "Is this result right?" A wrong-result report goes to a specialist's review queue with the quote and comment.
export default function Feedback({ runId, finding: f }: { runId: string; finding: Finding }) {
  const [state, setState] = useState<State>("idle");
  const [verdict, setVerdict] = useState<"correct" | "wrong">("correct");
  const [comment, setComment] = useState("");

  async function send(v: "correct" | "wrong", text = "") {
    setVerdict(v);
    setState("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          run_id: runId, finding_id: f.id, verdict: v, status: f.status,
          quoted_text: f.quoted_text, suggested_reference: f.suggested_reference, comment: text,
        }),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "sent")
    return (
      <p className="text-sm text-muted" aria-live="polite">
        {verdict === "wrong" ? "شكرًا، وصلنا بلاغك للمراجعة." : "شكرًا لتأكيدك."}
      </p>
    );

  return (
    <div className="space-y-2 border-t border-border pt-3 text-sm">
      {state !== "comment" ? (
        <div className="flex flex-wrap items-center gap-2 text-muted">
          <span>هل هذه النتيجة صحيحة؟</span>
          <button type="button" disabled={state === "sending"} onClick={() => send("correct")}
            className="rounded-full border border-border px-3 py-0.5 hover:bg-surface-muted hover:text-foreground">
            نعم
          </button>
          <button type="button" disabled={state === "sending"} onClick={() => setState("comment")}
            className="rounded-full border border-border px-3 py-0.5 hover:bg-surface-muted hover:text-foreground">
            فيها خطأ
          </button>
          {state === "error" && <span className="text-[var(--orange-fg)]">تعذّر الإرسال، حاول مرة أخرى.</span>}
        </div>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            send("wrong", comment.trim());
          }}
        >
          <label htmlFor={`fb-${f.id}`} className="block text-muted">ما الخطأ؟ (اختياري — مثل: الإحالة الصحيحة، أو لفظ أدق)</label>
          <textarea
            id={`fb-${f.id}`}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            rows={2}
            dir="auto"
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
          />
          <p className="text-xs text-muted">نحفظ هذا الاقتباس وملاحظتك فقط لمراجعتها، لا النص كاملًا.</p>
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-accent px-3 py-1 text-accent-contrast hover:bg-accent-hover">إرسال البلاغ</button>
            <button type="button" onClick={() => setState("idle")} className="rounded-lg px-3 py-1 text-muted hover:text-foreground">إلغاء</button>
          </div>
        </form>
      )}
    </div>
  );
}
