import { buildCorrected } from "./corrected";
import type { ReviewDecisions } from "./corrected";
import { STATUS, TYPE_LABEL } from "./labels";
import type { Evidence, VerifyResponse } from "./types";
import { evidenceReference } from "./references";

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[c]!);

function sourceLink(url: string | null): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) return "";
    return `<a href="${escape(parsed.href)}" target="_blank" rel="noopener noreferrer">فتح المصدر</a>`;
  } catch { return ""; }
}

function evidenceBlock(ev: Evidence): string {
  return `<section class="evidence">
    <h3>${escape(evidenceReference(ev))}</h3>
    <p class="muted">${escape(ev.source_label)} · ${ev.source_approved ? "من الحزمة العلمية" : "مصدر إضافي غير مدرج في الحزمة العلمية"}${ev.match_type === "semantic" ? " · مطابقة بالمعنى تحتاج مراجعة" : ""}</p>
    ${ev.context_before ? `<p class="source muted">${escape(ev.context_before)}</p>` : ""}
    <p class="source" dir="auto">${escape(ev.text)}</p>
    ${ev.context_after ? `<p class="source muted">${escape(ev.context_after)}</p>` : ""}
    ${ev.text_en ? `<p lang="en" dir="ltr">${escape(ev.text_en)}</p>` : ""}
    ${ev.takhrij ? `<p><strong>التخريج:</strong> ${escape(ev.takhrij)}</p>` : ""}
    ${sourceLink(ev.url)}
  </section>`;
}

// A self-contained local report: no uploaded document, external assets, or remote scripts.
export function buildReviewReport(text: string, result: VerifyResponse, decisions: ReviewDecisions, exportedAt: string): string {
  const corrected = buildCorrected(text, result.findings, decisions, "suggested");
  const proposals = new Set(corrected.proposals.map((p) => p.findingId));
  const included = result.findings.filter((f) => proposals.has(f.id) && decisions[f.id] !== "keep").length;
  const unresolved = result.findings.filter((f) => corrected.notes.some((n) => n.findingId === f.id && n.warn)
    || f.needs_scholar_review || (f.status !== "matches_source" && !(proposals.has(f.id) && decisions[f.id] !== "keep"))
    || !f.span || !f.evidence.length).length;
  const items = result.findings.map((f, index) => {
    const decision = proposals.has(f.id) ? decisions[f.id] : undefined;
    const decisionLabel = decision === "approve" ? "اختار المراجع تضمين الاقتراح" : decision === "keep" ? "أبقى المراجع الأصل" : proposals.has(f.id) ? "اقتراح مضمن افتراضيًا؛ ليس اعتمادًا بشريًا" : "لا يوجد اقتراح آلي؛ بقي الأصل كما هو";
    const note = corrected.notes.find((n) => n.findingId === f.id);
    return `<article>
      <h2>${index + 1}. ${escape(TYPE_LABEL[f.type])} · ${escape(STATUS[f.status].label)}</h2>
      <p class="muted">${escape(STATUS[f.status].hint)}</p>
      <h3>الاقتباس الأصلي</h3><blockquote dir="auto">${escape(f.quoted_text)}</blockquote>
      ${f.cited_reference ? `<p><strong>الإحالة المكتوبة:</strong> ${escape(f.cited_reference)}</p>` : ""}
      <p class="decision"><strong>خيار الاقتراح:</strong> ${decisionLabel}</p>
      ${f.evidence.map(evidenceBlock).join("\n")}
      <h3>الحكم المنقول · مستقل عن مطابقة النص</h3>
      ${f.gradings.length ? `<ul>${f.gradings.map((g) => `<li>${escape(g.scholar_ar ?? g.scholar)}: ${escape(g.grade_ar ?? g.grade)}${g.source_label ? ` — ${escape(g.source_label)}` : ""}${g.source_approved ? "" : " (مصدر إضافي)"}</li>`).join("")}</ul>` : '<p class="muted">لا يتضمن هذا الفحص حكمًا منقولًا لهذا الاقتباس.</p>'}
      ${f.needs_scholar_review ? `<p class="warning"><strong>تحتاج مراجعة مختص:</strong> ${escape(f.review_reasons.join("؛ ") || "نتيجة غير قاطعة")}</p>` : ""}
      ${note?.warn ? '<p class="warning">هذا الموضع ما زال يحتاج انتباه المراجع؛ الإبقاء على الأصل لا يعني مطابقته أو صحة الاستشهاد به.</p>' : ""}
      ${note ? `<ul>${note.lines.map((line) => `<li>${escape(line)}</li>`).join("")}</ul>` : ""}
      ${f.notes.length ? `<h3>ملاحظات الفحص</h3><ul>${f.notes.map((line) => `<li>${escape(line)}</li>`).join("")}</ul>` : ""}
    </article>`;
  }).join("\n");
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer">
<title>ميزان · تقرير المراجعة</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f6f4ee;color:#1a1f1c;font:16px/1.9 system-ui,Arial,sans-serif}main{max-width:950px;margin:auto;padding:32px 24px}h1{color:#0f5c46;font-size:30px}h2{font-size:21px}h3{font-size:16px;margin-bottom:6px}p{margin:8px 0}article,.document,.metadata{background:white;border:1px solid #e3ded2;border-radius:12px;padding:20px;margin:20px 0;overflow-wrap:anywhere}.muted{color:#5b625d;font-size:14px}.source{font-size:18px;white-space:pre-wrap}.evidence{border-right:3px solid #0f5c46;background:#f2f7f4;padding:12px 16px;margin:16px 0}blockquote{margin:12px 0;padding:12px 16px;background:#f1eee5;white-space:pre-wrap}.document{white-space:pre-wrap}.decision{color:#0f5c46;font-weight:500}.warning{background:#fbf0d9;color:#85570a;padding:10px 14px;border-radius:8px}a{color:#0f5c46}li{margin:6px 0}dl{display:grid;grid-template-columns:auto 1fr;gap:8px 20px}dd{margin:0;overflow-wrap:anywhere}dt{font-weight:600}button{border:0;border-radius:8px;background:#0f5c46;color:white;padding:12px 18px;font:inherit;cursor:pointer}@page{size:A4;margin:16mm}@media print{body{background:white;font-size:11pt}main{max-width:none;padding:0}button,.print-help{display:none}.metadata,.document,article{box-shadow:none}h2,h3{break-after:avoid}.evidence{break-inside:auto}a{color:#1a1f1c}p,li{orphans:3;widows:3}}
</style></head><body><main>
<button onclick="window.print()">طباعة / حفظ PDF</button><p class="print-help muted">التقرير محفوظ في هذا الملف محليًا. اختر حفظ بصيغة PDF من نافذة الطباعة.</p>
<h1>ميزان · تقرير المراجعة</h1>
<p>تقرير يساعد على مراجعة الاقتباسات ومصادرها. مطابقة النص لا تعني صحة الحديث، واعتماد التعديل لا يحلّ محل مراجعة المختص.</p>
<dl class="metadata"><dt>معرّف الفحص</dt><dd dir="auto">${escape(result.run_id)}</dd><dt>نسخة خط المعالجة</dt><dd>${escape(result.pipeline_version)}</dd><dt>نسخة المصادر</dt><dd>${escape(result.corpus_version)}</dd><dt>نطاق المصادر</dt><dd>${escape(result.corpus_scope.join("، "))}</dd><dt>طريقة الفحص</dt><dd>${result.llm_used ? "قواعد ومساعدة النموذج" : "قواعد فقط"}</dd><dt>وقت تصدير التقرير</dt><dd dir="ltr">${escape(exportedAt)}</dd></dl>
<p><strong>${result.findings.length}</strong> اقتباسات · <strong>${included}</strong> اقتراحات مضمنة · <strong>${unresolved}</strong> مواضع تحتاج انتباهك</p>
<h2>النص الأصلي الذي فُحص</h2><div class="document" dir="auto">${escape(text)}</div>
<h2>النسخة المقترحة · مع ملاحظات المصادر</h2><p class="muted">الاقتراحات من المصادر؛ تحتاج مراجعة قبل النشر ولا تعني اعتمادًا بشريًا أو تصحيحًا لحكم الحديث.</p><div class="document" dir="auto">${escape(corrected.plain)}</div>
<h2>تفاصيل الاقتباسات والأدلة</h2>${items || '<p class="warning">لم نجد اقتباسات قابلة للفحص. لا يعني ذلك سلامة جميع محتويات النص.</p>'}
<p class="muted">لا يشمل الفحص كل المصادر أو أنواع الادعاءات. المواضع غير المحسومة والحالات خارج النطاق تحتاج تحققًا إضافيًا.</p>
</main></body></html>`;
}
