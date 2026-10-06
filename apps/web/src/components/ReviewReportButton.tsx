"use client";

import { useState } from "react";
import { Download } from "@/components/Icons";
import type { ReviewDecisions } from "@/lib/corrected";
import { buildReviewReport } from "@/lib/review-report";
import type { VerifyResponse } from "@/lib/types";

export default function ReviewReportButton({ text, result, decisions }: {
  text: string; result: VerifyResponse; decisions: ReviewDecisions;
}) {
  const [message, setMessage] = useState("");
  function download() {
    let url: string | undefined;
    try {
      const html = buildReviewReport(text, result, decisions, new Date().toISOString());
      url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `mizan-review-${result.run_id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "report"}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setMessage("تم تجهيز التقرير. افتح الملف للطباعة أو الحفظ بصيغة PDF.");
    } catch {
      setMessage("تعذّر تجهيز التقرير. حاول مرة أخرى.");
    } finally {
      if (url) {
        const downloadUrl = url;
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }
    }
  }
  return (
    <div className="max-w-xs">
      <button type="button" onClick={download} aria-label="تنزيل تقرير المراجعة" title="ملف HTML محلي قابل للطباعة والحفظ بصيغة PDF" className="review-action review-action-accent w-full">
        <Download className="h-3.5 w-3.5" /><span>تنزيل التقرير</span>
      </button>
      {message && <p role="status" className="mt-1 text-xs leading-5 text-muted">{message}</p>}
    </div>
  );
}
