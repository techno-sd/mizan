// "Corrected copy": the checked text with each quote's wording and reference taken from its source, plus numbered
// source notes. Built only from the API response (the source passages and their matched spans); nothing here is
// written by a model. Quotes Mizan could not confirm are left as they are and flagged in the notes.
import type { Evidence, Finding } from "@/lib/types";

export type ChangeKind = "wording" | "reference" | "flag" | "note";

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
  segments: Segment[];
  notes: SourceNote[];
  changed: number; // quotes whose wording or reference was corrected
  added: number; // correct quotes that had no reference: one was added
  flagged: number; // quotes left for the writer to decide
  plain: string; // corrected text + notes, ready to paste
}

const HADITH_BOOK: Record<string, string> = {
  bukhari: "رواه البخاري", muslim: "رواه مسلم", abudawud: "رواه أبو داود", tirmidhi: "رواه الترمذي",
  nasai: "رواه النسائي", ibnmajah: "رواه ابن ماجه", malik: "رواه مالك",
};
const CLOSE = "»﴾\"”)";

// The reference a writer should cite: the approved takhrij («رواه مسلم»), the surah:ayah, or the book.
export function citation(ev: Evidence): string {
  if (ev.collection === "quran") return ev.reference;
  if (ev.collection === "hadeethenc") return ev.reference.split(" (موسوعة")[0].trim();
  return HADITH_BOOK[ev.collection] ?? ev.collection_label;
}

// The source's own wording for the quoted part, without quote marks, final punctuation or Quran pause marks.
export function sourceWording(ev: Evidence): string | null {
  if (!ev.highlight || ev.highlight_lang !== "ar") return null;
  const raw = ev.text.slice(ev.highlight.start, ev.highlight.end);
  const w = raw.replace(/^[\s«"“﴿(]+/, "").replace(/[\s»"”﴾).،,:؛ۖ-ۜ]+$/, "").trim();
  return w || null;
}

function gradingLine(f: Finding): string | null {
  if (!f.gradings.length) return null;
  const g = f.gradings.slice(0, 3).map((x) => `${x.scholar_ar ?? x.scholar}: ${x.grade_ar ?? x.grade}`).join("، ");
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
  return i === -1 ? null : { start: from + i, end: from + i + f.cited_reference.length };
}

// Just after the quote's closing mark (where a note marker goes when there is no reference).
function afterQuote(text: string, end: number): number {
  let i = end;
  while (i < text.length && i < end + 2 && CLOSE.includes(text[i])) i++;
  return i;
}

interface Edit { start: number; end: number; text: string; kind: ChangeKind; }

export function buildCorrected(text: string, findings: Finding[]): Corrected {
  const edits: Edit[] = [];
  const notes: SourceNote[] = [];
  let changed = 0, added = 0, flagged = 0;
  const ordered = findings.filter((f) => f.span).sort((a, b) => a.span!.start - b.span!.start);

  for (const f of ordered) {
    const ev = f.evidence[0];
    const lines: string[] = [];
    let warn = false, didChange = false;
    const cited = findCited(text, f);
    const isQuran = ev?.collection === "quran";

    if (ev && (f.status === "wording_differs" || (f.status === "reference_mismatch" && ev.match_type === "variant"))) {
      const w = sourceWording(ev);
      if (w) {
        edits.push({ start: f.span!.start, end: f.span!.end, text: w, kind: "wording" });
        lines.push(`صُحّح اللفظ من المصدر؛ كان: «${f.quoted_text}».`);
        didChange = true;
      } else {
        lines.push("اللفظ يختلف عن المصدر؛ راجعه يدويًا.");
        warn = true;
      }
    }
    if (ev && f.status === "reference_mismatch") {
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
        edits.push({ start: cited.start, end: cited.end, text: fixed, kind: "reference" });
        lines.push(`صُحّحت الإحالة؛ كانت: ${f.cited_reference}.`);
        didChange = true;
      } else if (!presentedAsVerse && !presentedAsHadith) {
        lines.push(`الإحالة الصحيحة: ${citation(ev)}.`);
      }
    }
    if (ev && f.status === "matches_source" && !cited) {
      // A correct quote with no reference: add one.
      const at = afterQuote(text, f.span!.end);
      edits.push({ start: at, end: at, text: isQuran ? ` [${citation(ev)}]` : ` (${citation(ev)})`, kind: "reference" });
      lines.push("أُضيفت الإحالة.");
      added++;
    }

    if (ev) {
      lines.unshift(`${ev.reference} — المصدر: ${ev.source_label}${ev.source_approved ? "" : " (مصدر إضافي غير مدرج في الحزمة العلمية)"}`);
      const g = gradingLine(f);
      if (g) lines.push(g);
      if (f.gradings.length && f.gradings.every((x) => x.category === "weak" || x.category === "rejected")) {
        lines.push("تنبيه: الأحكام المنقولة تضعّفه؛ يُراجع قبل الاستشهاد به.");
        warn = true;
      }
    } else if (f.status === "not_found") {
      lines.push(`«${f.quoted_text}»: لم يُعثر عليه في المصادر المحمّلة. هذا لا يعني أنه موضوع، لكن لا يُنسب إلى النبي ﷺ قبل التحقق؛ يُقترح حذفه أو عرضه على مختص.`);
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
    const after = edits.find((e) => e.start === markAt && e.end === markAt);
    if (after) after.text += ` [${n}]`;
    else edits.push({ start: markAt, end: markAt, text: ` [${n}]`, kind: warn ? "flag" : "note" });
    notes.push({ n, findingId: f.id, lines, url: ev?.url ?? null, warn });
    if (didChange) changed++;
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
  return { segments, notes, changed, added, flagged, plain };
}
