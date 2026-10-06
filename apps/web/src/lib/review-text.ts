import { citation, sourceWording } from "./corrected";
import type { DiffOp, Finding, Grading } from "./types";
import { gradingSummary } from "./labels";
import { issueHighlights } from "./issue-highlights";
import { citedReferenceSpan, toUtf16Span } from "./spans";

// What Mizan searched, named instead of "the loaded sources".
export const SEARCHED = "القرآن الكريم وموسوعة الأحاديث النبوية والكتب الستة وموطأ مالك";

export type Verdict = { label: string; tone: "ok" | "review" | "fix" | "neutral" };

// A two- or three-word verdict shown at the top of each quote.
export function verdict(f: Finding): Verdict {
  const ev = f.evidence[0];
  if (f.status === "out_of_scope") return { label: "لم يُفحص", tone: "neutral" };
  if (f.status === "not_found") return { label: "لم نجده", tone: "review" };
  if (!ev) return { label: "يحتاج مراجعة", tone: "review" };
  if (f.type === "quran" && ev.collection !== "quran") return { label: "حديث لا آية", tone: "review" };
  if (f.type === "hadith" && ev.collection === "quran") return { label: "آية لا حديث", tone: "review" };
  if ((f.needs_scholar_review && !reviewOnlyForRulings(f)) || ev.match_type === "semantic") return { label: "يحتاج مراجعة", tone: "review" };
  if (f.status === "reference_mismatch") return { label: "الإحالة غير صحيحة", tone: "fix" };
  if (f.status === "wording_differs") return { label: "اللفظ مختلف", tone: "fix" };
  return { label: "مطابق للمصدر", tone: reviewOnlyForRulings(f) ? "review" : "ok" };
}

// Flagged for review only because the reported rulings differ: the text match and its reference are certain.
export function reviewOnlyForRulings(f: Finding): boolean {
  return f.needs_scholar_review && f.review_reasons.length > 0 && f.review_reasons.every((r) => r.includes("متباينة"))
    && !!f.evidence[0] && f.evidence[0].match_type !== "semantic";
}

// The words that differ, from the word diff: "insert" is in the writer's text only, "delete" in the source only.
export function wordingChange(diff: DiffOp[]): string | null {
  const parts: string[] = [];
  let ins: string[] = [], del: string[] = [];
  const flush = () => {
    if (ins.length && del.length) parts.push(`«${ins.join(" ")}» بدل «${del.join(" ")}»`);
    else if (ins.length) parts.push(`زيادة «${ins.join(" ")}» ليست في المصدر`);
    else if (del.length) parts.push(`نقص «${del.join(" ")}» من لفظ المصدر`);
    ins = []; del = [];
  };
  for (const d of diff) {
    if (d.op === "equal") flush();
    else (d.op === "insert" ? ins : del).push(d.text);
  }
  flush();
  return parts.length ? `في لفظك ${parts.slice(0, 3).join("، و")}${parts.length > 3 ? "، وغير ذلك" : ""}.` : null;
}

// For a wrong reference: say what was written and whether the wording itself is right.
export function referenceChange(f: Finding): string | null {
  const ev = f.evidence[0];
  if (!ev || f.status !== "reference_mismatch" || verdict(f).tone !== "fix") return null;
  const cited = f.cited_reference ? f.cited_reference.replace(/^[\s[(«]+|[\s\])»]+$/g, "") : null;
  const written = cited ? `ذكرتَ «${cited}»، والصحيح «${citation(ev)}»` : `الصحيح «${citation(ev)}»`;
  return `${written}؛ ${["exact", "partial"].includes(ev.match_type) ? "اللفظ نفسه مطابق للمصدر" : "واللفظ أيضًا يختلف عن المصدر"}.`;
}

// One sentence for the reported rulings: the grade, who gave it, through which source, and what to do.
export function gradingSentence(f: Finding): string | null {
  if (!f.gradings.length) return null;
  const summary = gradingSummary(f);
  const name = (g: Grading) => g.scholar_ar ?? g.scholar;
  const grade = (g: Grading) => g.grade_ar ?? g.grade;
  if (summary?.short === "أحكام متباينة") {
    const groups = new Map<string, { names: string[]; refs: string[] }>();
    for (const g of f.gradings) {
      const e = groups.get(grade(g)) ?? { names: [], refs: [] };
      if (!e.names.includes(name(g))) e.names.push(name(g));
      const ref = g.reference?.split(" (موسوعة")[0];
      if (ref && !e.refs.includes(ref)) e.refs.push(ref);
      groups.set(grade(g), e);
    }
    const list = [...groups].slice(0, 4).map(([k, v]) => attributed(k, v.names.slice(0, 2)) + (v.refs.length ? ` في ${v.refs.slice(0, 2).join(" و")}` : "")).join("، و");
    return `الأحكام المنقولة: ${list}. راجعه قبل الاستشهاد به.`;
  }
  const main = f.gradings.find((g) => g.source_approved) ?? f.gradings[0];
  const same = f.gradings.filter((g) => grade(g) === grade(main)).map(name);
  const via = main.source_approved || !main.source_label ? "" : ` (عبر ${main.source_label}، خارج الحزمة العلمية)`;
  return `الحكم المنقول: ${attributed(grade(main), same.slice(0, 2))}${via}.${summary ? " راجعه قبل الاستشهاد به." : ""}`;
}

const attributed = (grade: string, names: string[]) =>
  /:|قال/.test(grade) ? `${grade} (${names.join("، ")})` : `${grade} عند ${names.join(" و")}`;

// The only reason for review is that the reported rulings differ: the match and its reference are certain.
export function onlyGradingConflict(f: Finding): boolean {
  return f.status === "matches_source" && f.evidence[0]?.match_type !== "semantic"
    && gradingSummary(f)?.short === "أحكام متباينة" && f.review_reasons.every((r) => r.includes("متباينة"));
}

function nearestHint(f: Finding): string {
  if (!f.nearest) return "";
  // The matched span if any, otherwise the first quoted words of the passage («…»).
  const w = sourceWording(f.nearest) ?? f.nearest.text.match(/«([^»]{3,90})»/)?.[1]?.replace(/[ً-ْ]/g, "").trim() ?? null;
  const text = w && Array.from(w).length <= 90 ? `«${w}» — ` : "";
  return ` أقرب نص في المصادر، وهو نص مختلف للمقارنة فقط: ${text}${citation(f.nearest)}.`;
}

export function reviewOriginal(f: Finding, documentText?: string): { text: string; segments: { text: string; issue: boolean }[] } {
  const quote = documentText === undefined ? null : toUtf16Span(documentText, f.span);
  let text: string;
  let ranges: { start: number; end: number }[] = [];
  if (documentText !== undefined && quote && quote.end > quote.start) {
    let start = quote.start, end = quote.end;
    const pairs: Record<string, string> = { "﴿": "﴾", "«": "»", "“": "”", '"': '"', "(": ")" };
    if (start > 0 && pairs[documentText[start - 1]] === documentText[end]) { start--; end++; }
    const reference = citedReferenceSpan(documentText, quote, f.cited_reference);
    if (reference) end = Math.max(end, reference.end);
    text = documentText.slice(start, end);
    ranges = issueHighlights(documentText, [f]).filter((item) => item.className === "mark-amber"
      && ["reference_mismatch", "wording_differs"].includes(f.status))
      .map((item) => ({ start: item.span.start - start, end: item.span.end - start }));
  } else {
    // Without document offsets, retain the extracted original, never substitute source wording.
    const quran = f.type === "quran" && !/[a-z]/i.test(f.quoted_text);
    const open = quran ? "﴿" : "«", close = quran ? "﴾" : "»";
    text = `${open}${f.quoted_text}${close}`;
    if (f.cited_reference) text += quran ? ` [${f.cited_reference}]` : ` (${f.cited_reference})`;
  }
  const segments: { text: string; issue: boolean }[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor || range.end > text.length) continue;
    if (range.start > cursor) segments.push({ text: text.slice(cursor, range.start), issue: false });
    segments.push({ text: text.slice(range.start, range.end), issue: true });
    cursor = range.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), issue: false });
  return { text, segments };
}

export function reviewCorrection(f: Finding): string | null {
  if (reviewText(f).tone !== "fix") return null;
  const ev = f.evidence[0];
  if (!ev) return null;
  let wording = sourceWording(ev);
  if (!wording && ev.highlight_lang === "en" && ev.text_en) {
    const span = toUtf16Span(ev.text_en, ev.highlight);
    if (span) wording = ev.text_en.slice(span.start, span.end).trim();
  }
  if (!wording && f.status === "reference_mismatch" && ["exact", "partial"].includes(ev.match_type)) wording = f.quoted_text;
  if (!wording) return null;
  const quran = ev.collection === "quran";
  const arabicVerse = quran && !ev.translation_lang && !/[a-z]/i.test(wording);
  return `${arabicVerse ? "﴿" : "«"}${wording}${arabicVerse ? "﴾" : "»"} ${quran ? "[" : "("}${citation(ev)}${quran ? "]" : ")"}`;
}

export function reviewQuotation(f: Finding, limit?: number): string {
  const ev = f.evidence[0];
  const quran = f.type === "quran" && !/[a-z]/i.test(f.quoted_text);
  const verified = quran && ev?.collection === "quran" && !f.needs_scholar_review
    && ["exact", "partial"].includes(ev.match_type) && ["matches_source", "reference_mismatch"].includes(f.status);
  const wording = verified ? sourceWording(ev) ?? f.quoted_text : f.quoted_text;
  const characters = Array.from(wording);
  const excerpt = limit && characters.length > limit ? characters.slice(0, limit).join("") + "…" : wording;
  return `${quran ? "﴿" : "«"}${excerpt}${quran ? "﴾" : "»"}`;
}

// Deterministic conversational copy from verified findings, never a new model verdict.
export function reviewText(f: Finding): { text: string; reference: string | null; tone: "ok" | "review" | "fix" | "neutral" } {
  const ev = f.evidence[0];
  if (f.status === "out_of_scope") return { text: f.type === "attributed_quote" ? "الأقوال المنسوبة لغير النبي ﷺ خارج نطاق هذه النسخة؛ لم يُتحقّق منه." : "خارج نطاق هذه النسخة؛ لم يُتحقّق منه.", reference: null, tone: "neutral" };
  if (f.status === "not_found") return { text: `لم نجده في ${SEARCHED}. هذا لا يعني أنه موضوع، لكن لا تنسبه قبل التحقق منه.${nearestHint(f)}`, reference: null, tone: "review" };
  if (!ev) return { text: "لم تتوفر أدلة كافية لهذه النتيجة؛ راجعها يدويًا.", reference: null, tone: "review" };
  if (ev && ((f.type === "quran" && ev.collection !== "quran") || (f.type === "hadith" && ev.collection === "quran"))) {
    return { text: f.type === "quran" ? "هذا النص حديث نبوي وليس آية؛ عدّل عبارة تقديمه (مثل «قال تعالى»)." : "هذا النص آية وليس حديثًا؛ عدّل عبارة تقديمه.", reference: citation(ev), tone: "review" };
  }
  if ((f.needs_scholar_review && !reviewOnlyForRulings(f)) || ev?.match_type === "semantic") {
    // The grading sentence already reports conflicting rulings, so they are not repeated here.
    const conflict = gradingSummary(f)?.short === "أحكام متباينة";
    const reasons = f.review_reasons.filter((r) => !(conflict && r.includes("متباينة")));
    if (conflict && !reasons.length && ev.match_type !== "semantic" && f.status === "matches_source")
      return { text: "مطابق للنص في المصدر، لكن الأحكام المنقولة فيه متباينة.", reference: citation(ev), tone: "review" };
    const reason = reasons.join("؛ ").replace(/[.。]+$/, "");
    return { text: "يحتاج مراجعة" + (reason ? ": " + reason + "." : ev?.match_type === "semantic" ? ": المطابقة بالمعنى لا تثبت اللفظ أو الإحالة." : "؛ النتيجة غير قاطعة."), reference: ev ? citation(ev) : null, tone: "review" };
  }
  if (f.status === "reference_mismatch") return { text: "صحّح الإحالة إلى", reference: ev ? citation(ev) : null, tone: "fix" };
  if (f.status === "wording_differs") {
    const wording = ev ? sourceWording(ev) : null;
    return { text: wording ? `اللفظ في المصدر: ${ev?.collection === "quran" ? "﴿" : "«"}${wording}${ev?.collection === "quran" ? "﴾" : "»"}.` : "اللفظ يختلف عن المصدر؛ راجعه قبل النشر.", reference: ev ? citation(ev) : null, tone: "fix" };
  }
  if (reviewOnlyForRulings(f)) return { text: "مطابق للنص في المصدر، لكن الأحكام المنقولة فيه متباينة.", reference: ev ? citation(ev) : null, tone: "review" };
  if (ev?.translation_label) return { text: `مطابق لترجمة معاني الآية المعتمدة: ${ev.translation_label}.`, reference: citation(ev), tone: "ok" };
  return { text: "مطابق للنص في المصدر.", reference: ev ? citation(ev) : null, tone: "ok" };
}

// "الإحالة" for a quote that had one, "أضف الإحالة" when the writer gave none, "المرجع المحتمل" when uncertain.
export function referenceLabel(f: Finding, tone: Verdict["tone"]): string {
  return tone === "review" && !onlyGradingConflict(f) ? " المرجع المحتمل" : f.cited_reference ? " الإحالة" : " أضف الإحالة";
}

export function reviewPlainText(findings: Finding[], documentText?: string): string {
  const lines = findings.map((f, index) => {
    const message = reviewText(f);
    const reference = message.reference ? message.tone === "fix" && f.status === "reference_mismatch" ? ` ${message.reference}.` : `${referenceLabel(f, message.tone)}: ${message.reference}.` : "";
    const grade = gradingSentence(f);
    const ev = f.evidence[0];
    const corrected = reviewCorrection(f);
    const detail = referenceChange(f) ?? (f.status === "wording_differs" && message.tone === "fix" ? wordingChange(f.diff) : null);
    return `${index + 1}. ${verdict(f).label}\nفي نصّك: ${reviewOriginal(f, documentText).text}\n${detail ? detail + "\n" : ""}${corrected ? `الصحيح: ${corrected}` : `${message.text}${reference}`}${grade ? " " + grade : ""}${ev ? ` [${index + 1}]` : ""}`;
  });
  const sources = findings.flatMap((f, index) => f.evidence.length ? [`[${index + 1}] ${citation(f.evidence[0])}${f.evidence[0].url && /^https?:\/\//i.test(f.evidence[0].url) ? ` ${f.evidence[0].url}` : ""}`] : []);
  const comment = reviewComment(findings);
  return [comment.overview, comment.advice, "", ...lines, "", "مطابقة اللفظ لا تعني صحة الحديث. الأحكام المذكورة منقولة من مصادرها.", ...(sources.length ? ["", "المصادر:", ...sources] : [])].join("\n");
}

export function reviewComment(findings: Finding[]): { overview: string; advice: string } {
  if (!findings.length) return {
    overview: "لم نجد اقتباسات قابلة للفحص في هذا النص.",
    advice: "قد تحتاج إلى مصادر خارج نطاق هذه النسخة؛ عدم العثور على اقتباسات لا يعني سلامة النص كله.",
  };
  const fixes = findings.filter((f) => reviewText(f).tone === "fix");
  const uncertain = findings.filter((f) => reviewText(f).tone === "review");
  const outside = findings.filter((f) => f.status === "out_of_scope");
  const matches = findings.filter((f) => reviewText(f).tone === "ok");
  const gradingWarnings = findings.some((f) => gradingSummary(f) !== null);
  const overview = fixes.length ? "وجدنا مواضع تحتاج تصحيحًا قبل النشر."
    : uncertain.length || outside.length || gradingWarnings
      ? matches.length ? "وجدنا نصوصًا مطابقة، مع مواضع تحتاج تحققًا إضافيًا." : "هذه الاقتباسات تحتاج تحققًا إضافيًا قبل الاستشهاد بها."
      : `ألفاظ الاقتباسات التي فحصناها تطابق مصادر ميزان (${SEARCHED}).`;
  const actions = [
    fixes.length ? fixes.every((f) => f.status === "reference_mismatch") ? "صحّح الإحالات المظللة أدناه" : "صحّح اللفظ والإحالات المشار إليها أدناه" : "",
    uncertain.length ? "تحقّق من المواضع غير القاطعة في مصادرها قبل الاستشهاد بها" : "",
    gradingWarnings ? "انتبه إلى الأحكام المنقولة، فوجود النص في مصدر لا يعني صحة الحديث" : "",
    outside.length ? "اعلم أن المواضع خارج نطاق الفحص لم يُتحقّق منها" : "",
    matches.some((f) => !f.cited_reference) ? "أضف المراجع الناقصة إلى الاقتباسات المطابقة" : "",
  ].filter(Boolean);
  return { overview, advice: actions.length ? actions.slice(0, 2).join("، و") + "." : "احتفظ بالألفاظ المطابقة، وافتح المراجع المرقّمة للاطّلاع على مصادرها." };
}

// "الإحالة غير صحيحة 2 · اللفظ مختلف 1 · لم نجده 1 · مطابق للمصدر 3", in the order a writer should act.
export function reviewBreakdown(findings: Finding[]): { label: string; count: number; tone: Verdict["tone"] }[] {
  const order = ["الإحالة غير صحيحة", "اللفظ مختلف", "حديث لا آية", "آية لا حديث", "لم نجده", "يحتاج مراجعة", "مطابق للمصدر", "لم يُفحص"];
  const counts = new Map<string, { label: string; count: number; tone: Verdict["tone"] }>();
  for (const f of findings) {
    const v = verdict(f);
    const c = counts.get(v.label) ?? { label: v.label, count: 0, tone: v.tone };
    c.count++;
    counts.set(v.label, c);
  }
  return [...counts.values()].sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
}
