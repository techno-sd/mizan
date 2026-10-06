// Source-based draft builder. Suggested mode includes eligible changes unless excluded; explicit-review mode
// applies only approved changes. Notes preserve provenance and uncertainty. Ambiguous, semantic and overlapping
// quotations stay unchanged in both modes; draft inclusion never implies human or scholarly approval.
import type { Evidence, Finding } from "@/lib/types";
import { toUtf16Span } from "./spans";
import { evidenceReference } from "./references";

export type ChangeKind = "wording" | "reference" | "flag" | "note";
export type ReviewDecision = "approve" | "keep";
export type ReviewDecisions = Record<string, ReviewDecision>;

export interface CorrectionProposal {
  findingId: string;
  changes: { before: string; after: string; kind: "wording" | "reference" }[];
}

export interface Segment {
  text: string;
  kind?: ChangeKind; // set on inserted or replaced text
  was?: string; // the original text it replaced
}

export interface SourceNote {
  n: number;
  findingId: string;
  lines: string[];
  url: string | null;
  warn: boolean;
}

export interface Corrected {
  text: string; // clean suggested text, without report footnote markers
  segments: Segment[];
  notes: SourceNote[];
  changed: number; // quotes whose wording or reference was corrected
  added: number; // correct quotes that had no reference: one was added
  flagged: number; // quotes left for the writer to decide
  pending: number;
  proposals: CorrectionProposal[];
  plain: string; // corrected text + notes, ready to paste
}

const HADITH_BOOK: Record<string, string> = {
  bukhari: "رواه البخاري", muslim: "رواه مسلم", abudawud: "رواه أبو داود", tirmidhi: "رواه الترمذي",
  nasai: "رواه النسائي", ibnmajah: "رواه ابن ماجه", malik: "رواه مالك",
};
const CLOSE = "»﴾\"”)";

// The reference a writer should cite: the approved takhrij («رواه مسلم»), the surah:ayah, or the book.
export function citation(ev: Evidence): string {
  if (ev.collection === "quran") return evidenceReference(ev);
  if (ev.collection === "hadeethenc") return ev.reference.split(" (موسوعة")[0].trim();
  return HADITH_BOOK[ev.collection] ?? ev.collection_label;
}

// The source's own wording for the quoted part, without quote marks, final punctuation or Quran pause marks.
export function sourceWording(ev: Evidence): string | null {
  if (!ev.highlight || ev.highlight_lang !== "ar") return null;
  const span = toUtf16Span(ev.text, ev.highlight);
  if (!span) return null;
  const raw = ev.text.slice(span.start, span.end);
  const w = raw.replace(/^[\s«"“﴿(]+/, "").replace(/[\s»"”﴾).،,:؛ۖ-ۜ]+$/, "").trim();
  return w || null;
}

// Rulings reported on the matched passage itself (or with no passage recorded), not on another narration.
const onPassage = (f: Finding, ev: Evidence) => f.gradings.filter((x) => !x.reference || x.reference === ev.reference);

function gradingLine(f: Finding, ev: Evidence): string | null {
  if (!f.gradings.length) return null;
  const g = f.gradings.slice(0, 3).map((x) => `${x.scholar_ar ?? x.scholar}: ${x.grade_ar ?? x.grade}${x.reference && x.reference !== ev.reference ? ` (في ${x.reference})` : ""}`).join("، ");
  const first = f.gradings[0];
  const via = first.source_label && !first.source_approved ? ` (عبر ${first.source_label}، غير مدرج في الحزمة العلمية)` : "";
  return `الحكم المنقول: ${g}${via}`;
}

// Where the cited reference sits right after the quote (it may follow the closing mark and a space).
function findCited(text: string, f: Finding): { start: number; end: number } | null {
  if (!f.span || !f.cited_reference) return null;
  const from = f.span.end;
  const window = text.slice(from, from + 60 + f.cited_reference.length);
  const i = window.indexOf(f.cited_reference);
  if (i === -1) return null;
  let start = from + i, end = start + f.cited_reference.length;
  // Rule extraction returns the inner reference; include its existing brackets when replacing it.
  if ((text[start - 1] === "[" && text[end] === "]") || (text[start - 1] === "(" && text[end] === ")")) {
    start--;
    end++;
  }
  return { start, end };
}

// Just after the quote's closing mark (where a note marker goes when there is no reference).
function afterQuote(text: string, end: number): number {
  let i = end;
  while (i < text.length && i < end + 2 && CLOSE.includes(text[i])) i++;
  return i;
}

interface Edit { start: number; end: number; text: string; kind: ChangeKind; }

function verseBounds(text: string, start: number, end: number): { start: number; end: number; wording: string } {
  const pairs: Record<string, string> = { "﴿": "﴾", "«": "»", "“": "”", '"': '"', "(": ")" };
  if (start > 0 && pairs[text[start - 1]] === text[end]) {
    start--;
    end++;
  }
  let wording = text.slice(start, end).trim();
  if (pairs[wording[0]] === wording.at(-1)) wording = wording.slice(1, -1).trim();
  return { start, end, wording };
}

export function buildCorrected(text: string, findings: Finding[], decisions: ReviewDecisions = {}, mode: "review" | "suggested" = "review"): Corrected {
  const edits: Edit[] = [];
  const notes: SourceNote[] = [];
  const proposals: CorrectionProposal[] = [];
  let pending = 0;
  let changed = 0, added = 0, flagged = 0;
  const ordered = findings.map((f) => ({ ...f, span: toUtf16Span(text, f.span) }))
    .filter((f) => f.span && f.span.end > f.span.start).sort((a, b) => a.span!.start - b.span!.start);
  const overlapping = new Set<string>();
  for (let i = 0; i < ordered.length; i++) {
    const a = ordered[i];
    const end = findCited(text, a)?.end ?? afterQuote(text, a.span!.end);
    for (let j = i + 1; j < ordered.length && ordered[j].span!.start < end; j++) {
      overlapping.add(a.id);
      overlapping.add(ordered[j].id);
    }
  }

  for (const f of ordered) {
    const ev = f.evidence[0];
    const lines: string[] = [];
    let warn = false, didChange = false;
    const cited = findCited(text, f);
    const isQuran = ev?.collection === "quran";
    const wrongType = ev && ((f.type === "quran" && !isQuran) || (f.type === "hadith" && isQuran));
    const canEdit = !f.needs_scholar_review && ev?.match_type !== "semantic" && !wrongType
      && !overlapping.has(f.id) && ["matches_source", "wording_differs", "reference_mismatch"].includes(f.status);
    const quoteEdits: Edit[] = [];
    let didAdd = false;
    let correctedWording: string | null = null;
    if (ev && !canEdit) {
      lines.push("تُرك النص والإحالة كما كتبتهما؛ راجع النتيجة والمصدر يدويًا قبل اعتماد أي تعديل.");
      warn = true;
    }

    if (ev && canEdit && (f.status === "wording_differs" || (f.status === "reference_mismatch" && ev.match_type === "variant"))) {
      const w = sourceWording(ev);
      if (w) {
        correctedWording = w;
        if (!isQuran) quoteEdits.push({ start: f.span!.start, end: f.span!.end, text: w, kind: "wording" });
        lines.push(`اللفظ المقترح من المصدر: «${w}»؛ الأصل: «${f.quoted_text}».`);
        didChange = true;
      } else {
        lines.push("اللفظ يختلف عن المصدر؛ راجعه يدويًا.");
        warn = true;
      }
    }
    if (isQuran && canEdit && ev.highlight_lang === "ar" && (correctedWording || f.status === "matches_source" || ev.match_type === "exact" || ev.match_type === "partial")) {
      const bounds = verseBounds(text, f.span!.start, f.span!.end);
      const formatted = `﴿${correctedWording ?? sourceWording(ev) ?? bounds.wording}﴾`;
      if (text.slice(bounds.start, bounds.end) !== formatted) {
        quoteEdits.push({ start: bounds.start, end: bounds.end, text: formatted, kind: "wording" });
        if (!correctedWording) lines.push("تنسيق الآية بالرسم الوارد في المصدر وبين القوسين القرآنيين.");
        didChange = true;
      }
    } else if (isQuran && correctedWording) {
      quoteEdits.push({ start: f.span!.start, end: f.span!.end, text: correctedWording, kind: "wording" });
    }
    if (ev && canEdit && f.status === "reference_mismatch") {
      const presentedAsVerse = f.type === "quran" && !isQuran;
      const presentedAsHadith = f.type === "hadith" && isQuran;
      if (presentedAsVerse || presentedAsHadith) {
        lines.push(presentedAsVerse
          ? `تنبيه: هذا حديث نبوي وليس آية (${citation(ev)})؛ عدّل عبارة التقديم.`
          : "تنبيه: هذا النص آية قرآنية وليس حديثًا؛ عدّل عبارة التقديم.");
        warn = true;
      }
      const fixed = isQuran ? `[${citation(ev)}]` : `(${citation(ev)})`;
      if (cited) {
        quoteEdits.push({ start: cited.start, end: cited.end, text: fixed, kind: "reference" });
        lines.push(`الإحالة المقترحة: ${citation(ev)}؛ الأصل: ${f.cited_reference}.`);
        didChange = true;
      } else if (!presentedAsVerse && !presentedAsHadith) {
        lines.push(`الإحالة الصحيحة: ${citation(ev)}؛ راجعها يدويًا، إذ لم نتمكّن من تحديد موضع الإحالة المكتوبة لاستبدالها.`);
        warn = true;
      }
    }
    if (ev && canEdit && isQuran && cited && f.status !== "reference_mismatch") {
      const fixed = `[${citation(ev)}]`;
      if (text.slice(cited.start, cited.end) !== fixed) {
        quoteEdits.push({ start: cited.start, end: cited.end, text: fixed, kind: "reference" });
        lines.push("توحيد تنسيق إحالة السورة والآية.");
        didChange = true;
      }
    }
    if (ev && canEdit && !f.cited_reference && (f.status === "matches_source" || (isQuran && correctedWording))) {
      // Add the source citation to a verified or source-corrected quote that has none.
      const at = afterQuote(text, f.span!.end);
      quoteEdits.push({ start: at, end: at, text: isQuran ? ` [${citation(ev)}]` : ` (${citation(ev)})`, kind: "reference" });
      lines.push("إحالة مقترحة للإضافة.");
      didAdd = true;
    }

    if (quoteEdits.length) {
      proposals.push({ findingId: f.id, changes: quoteEdits.map((e) => ({
        before: text.slice(e.start, e.end), after: e.text, kind: e.kind as "wording" | "reference",
      })) });
      if (decisions[f.id] === "approve" || (mode === "suggested" && decisions[f.id] !== "keep")) {
        edits.push(...quoteEdits);
        lines.push(mode === "suggested"
          ? decisions[f.id] === "approve" ? "اختار المراجع تضمين الاقتراح في النص المقترح." : "اقتراح من المصدر مضمن افتراضيًا في النسخة المقترحة؛ ليس اعتمادًا بشريًا ويُراجع قبل النشر."
          : "اعتمد المراجع التعديل المقترح؛ الاعتماد يخص اللفظ والإحالة ولا يحكم بصحة الحديث.");
        if (didChange) changed++;
        if (didAdd) added++;
      } else if (decisions[f.id] === "keep") {
        lines.push("اختار المراجع الإبقاء على النص والإحالة الأصليين.");
        if (f.status !== "matches_source") warn = true;
      } else {
        lines.push("التعديل المقترح بانتظار قرار المراجع؛ تُرك النص الأصلي دون تغيير.");
        pending++;
        warn = true;
      }
    }

    if (ev) {
      lines.unshift(`${evidenceReference(ev)} — المصدر: ${ev.source_label}${ev.source_approved ? "" : " (مصدر إضافي غير مدرج في الحزمة العلمية)"}`);
      const g = gradingLine(f, ev);
      if (g) lines.push(g);
      const own = onPassage(f, ev);
      if (own.length && own.every((x) => x.category === "weak" || x.category === "rejected")) {
        lines.push("تنبيه: الأحكام المنقولة تضعّفه؛ يُراجع قبل الاستشهاد به.");
        warn = true;
      }
    } else if (f.status === "not_found") {
      lines.push(`«${f.quoted_text}»: لم نجده في مصادر ميزان (القرآن الكريم وموسوعة الأحاديث النبوية والكتب الستة وموطأ مالك). هذا لا يعني أنه موضوع، لكن لا يُنسب إلى النبي ﷺ قبل التحقق؛ يُقترح حذفه أو عرضه على مختص.`);
      warn = true;
    } else if (f.status === "out_of_scope") {
      lines.push(`«${f.quoted_text}»: خارج نطاق الفحص؛ لم يُتحقق منه.`);
      warn = true;
    }
    if (f.needs_scholar_review) {
      lines.push(`يحتاج مراجعة مختص: ${f.review_reasons.map((r) => r.replace(/[.。]+$/, "")).join("؛ ") || "نتيجة غير قاطعة"}.`);
      warn = true;
    }
    if (!lines.length) continue;

    const n = notes.length + 1;
    const markAt = cited ? cited.end : afterQuote(text, f.span!.end);
    edits.push({ start: markAt, end: markAt, text: ` [${n}]`, kind: warn ? "flag" : "note" });
    notes.push({ n, findingId: f.id, lines, url: ev?.url ?? null, warn });
    if (warn) flagged++;
  }

  // Apply edits left to right; skip any that overlap an earlier one.
  edits.sort((a, b) => a.start - b.start || a.end - b.end);
  const segments: Segment[] = [];
  let cursor = 0;
  for (const e of edits) {
    if (e.start < cursor) continue;
    if (e.start > cursor) segments.push({ text: text.slice(cursor, e.start) });
    segments.push({ text: e.text, kind: e.kind, was: e.end > e.start ? text.slice(e.start, e.end) : undefined });
    cursor = e.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });

  const body = segments.map((s) => s.text).join("");
  const plain = notes.length
    ? `${body}\n\n— المصادر —\n${notes.map((x) => `[${x.n}] ${x.lines.join(" ")}${x.url ? ` ${x.url}` : ""}`).join("\n")}`
    : body;
  const cleanText = segments.filter((s) => s.kind !== "flag" && s.kind !== "note").map((s) => s.text).join("");
  return { text: cleanText, segments, notes, changed, added, flagged, pending, proposals, plain };
}
