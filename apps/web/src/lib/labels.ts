import type { Finding, Grading, ItemType, ReferenceStatus } from "./types";

export const STATUS: Record<
  ReferenceStatus,
  { label: string; hint: string; tone: string; mark: string }
> = {
  reference_mismatch: {
    label: "الإحالة غير صحيحة",
    hint: "النص موجود، لكن ليس في الموضع الذي ذكرته.",
    tone: "tone-orange",
    mark: "mark-orange",
  },
  wording_differs: {
    label: "اللفظ مختلف",
    hint: "النص في المصدر بلفظ يختلف عمّا كتبته.",
    tone: "tone-amber",
    mark: "mark-amber",
  },
  not_found: {
    label: "لم نجده في المصادر",
    hint: "غير موجود في مصادر ميزان. هذا لا يعني بالضرورة أنه موضوع.",
    tone: "tone-slate",
    mark: "mark-slate",
  },
  matches_source: {
    label: "مطابق للمصدر",
    hint: "النص والإحالة يطابقان المصدر. المطابقة تعني وجود النص، لا الحكم بصحته؛ راجع الأحكام أدناه إن وُجدت.",
    tone: "tone-green",
    mark: "mark-green",
  },
  out_of_scope: {
    label: "لم يُفحص",
    hint: "هذه النسخة لا تفحص هذا النوع.",
    tone: "tone-zinc",
    mark: "mark-zinc",
  },
};

// Grading axis, shown next to the text-axis status. "Matches the source" must never read as "authentic".
export function gradingSummary(f: Finding): { label: string; short: string; tone: string; mark: string } | null {
  const cats = new Set(f.gradings.map((g) => g.category));
  if (cats.has("accepted") && (cats.has("weak") || cats.has("rejected")))
    return { label: "أحكام العلماء فيه متباينة", short: "أحكام متباينة", tone: "tone-violet", mark: "mark-amber" };
  if (cats.has("rejected")) return { label: "ضعّفه بشدة من نُقل حكمه", short: "ضعيف جدًا", tone: "tone-orange", mark: "mark-orange" };
  if (cats.has("weak")) return { label: "ضعّفه من نُقل حكمه", short: "ضعيف", tone: "tone-amber", mark: "mark-amber" };
  return null;
}

export function markClass(f: Finding): string {
  const g = f.status === "matches_source" || f.status === "wording_differs" ? gradingSummary(f) : null;
  return g?.mark ?? STATUS[f.status].mark;
}

// Order findings so the problems come first.
export const STATUS_ORDER: ReferenceStatus[] = [
  "reference_mismatch",
  "not_found",
  "wording_differs",
  "matches_source",
  "out_of_scope",
];

export function sortFindings(findings: Finding[]): Finding[] {
  const rank = (f: Finding) =>
    STATUS_ORDER.indexOf(f.status) * 2 -
    (f.needs_scholar_review ? 1 : 0) -
    (f.gradings.some((g) => g.category === "rejected") ? 2 : f.gradings.some((g) => g.category === "weak") ? 0.5 : 0);
  return [...findings].sort((a, b) => rank(a) - rank(b));
}

// Compact result filters. A finding can belong to several (e.g. "fix" and "review").
export type Filter = "all" | "fix" | "not_found" | "matches" | "review" | "out_of_scope";

export const FILTERS: { key: Exclude<Filter, "all">; label: string; tone: string; test: (f: Finding) => boolean }[] = [
  { key: "fix", label: "تحتاج تصحيحًا", tone: "tone-orange", test: (f) => f.status === "reference_mismatch" || f.status === "wording_differs" },
  { key: "not_found", label: "لم يُعثر عليها", tone: "tone-slate", test: (f) => f.status === "not_found" },
  { key: "review", label: "تحتاج مراجعة", tone: "tone-violet", test: (f) => f.needs_scholar_review || gradingSummary(f) !== null },
  { key: "matches", label: "مطابقة للنص", tone: "tone-green", test: (f) => f.status === "matches_source" },
  { key: "out_of_scope", label: "خارج النطاق", tone: "tone-zinc", test: (f) => f.status === "out_of_scope" },
];

export const inFilter = (f: Finding, filter: Filter) =>
  filter === "all" || (FILTERS.find((x) => x.key === filter)?.test(f) ?? true);

// Problems are expanded by default; clean matches start collapsed so they don't bury what needs attention.
export const startsExpanded = (f: Finding) =>
  f.status !== "matches_source" || f.needs_scholar_review || gradingSummary(f) !== null;

export const TYPE_LABEL: Record<ItemType, string> = {
  quran: "آية",
  hadith: "حديث",
  attributed_quote: "قول منسوب",
  general_claim: "ادعاء عام",
};

export const GRADE_TONE: Record<Grading["category"], string> = {
  accepted: "grade-accepted",
  weak: "grade-weak",
  rejected: "grade-rejected",
  unknown: "grade-unknown",
};
