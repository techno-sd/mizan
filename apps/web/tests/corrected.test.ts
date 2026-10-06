import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCorrected, sourceWording } from "../src/lib/corrected";
import type { ReviewDecisions } from "../src/lib/corrected";
import { toUtf16Span } from "../src/lib/spans";
import { formatQuranReference, evidenceReference } from "../src/lib/references";
import type { Evidence, Finding, Span } from "../src/lib/types";

function spanOf(text: string, quote: string): Span {
  const start = Array.from(text.slice(0, text.indexOf(quote))).length;
  return { start, end: start + Array.from(quote).length };
}

function evidence(text = "قُلْ هُوَ اللَّهُ أَحَدٌ", quote = text): Evidence {
  return {
    passage_id: 1, collection: "quran", collection_label: "القرآن", reference: "الإخلاص: 1",
    number: 1, numbering_scheme: null, text, text_en: null, url: null, similarity: 85,
    match_type: "variant", context_before: null, context_after: null,
    highlight: spanOf(text, quote), highlight_lang: "ar", takhrij: null,
    source_id: "quranenc", source_label: "QuranEnc", source_url: "", source_approved: true,
  };
}

function finding(text: string, quote: string, overrides: Partial<Finding> = {}): Finding {
  return {
    id: "f1", type: "quran", span: spanOf(text, quote), quoted_text: quote, attributed_to: null,
    cited_reference: "الإخلاص: 1", status: "wording_differs", needs_scholar_review: false,
    review_reasons: [], evidence: [evidence()], nearest: null, gradings: [], diff: [],
    suggested_reference: "الإخلاص: 1", notes: [], ...overrides,
  };
}

test("emoji offsets preserve brackets and replace the entire altered quote", () => {
  const text = "🌙📖 قال تعالى: ﴿قل هو الله واحد﴾ [الإخلاص: 1].";
  const result = buildCorrected(text, [finding(text, "قل هو الله واحد")], { f1: "approve" });
  assert.equal(result.segments.map((s) => s.text).join(""),
    "🌙📖 قال تعالى: ﴿قُلْ هُوَ اللَّهُ أَحَدٌ﴾ [سورة الإخلاص: 1] [1].");
  assert.equal(result.changed, 1);
});

test("source highlights use code points even when a source contains emojis", () => {
  assert.equal(sourceWording(evidence("📖 قُلْ هُوَ اللَّهُ أَحَدٌ", "قُلْ هُوَ اللَّهُ أَحَدٌ")), "قُلْ هُوَ اللَّهُ أَحَدٌ");
});

test("a reference correction replaces the existing brackets once", () => {
  const text = "🌙 ﴿قل هو الله أحد﴾ [الإخلاص: 2].";
  const f = finding(text, "قل هو الله أحد", {
    status: "reference_mismatch", cited_reference: "الإخلاص: 2",
    evidence: [{ ...evidence(), match_type: "exact" }],
  });
  assert.equal(buildCorrected(text, [f], { f1: "approve" }).segments.map((s) => s.text).join(""),
    "🌙 ﴿قُلْ هُوَ اللَّهُ أَحَدٌ﴾ [سورة الإخلاص: 1] [1].");
});

test("ambiguous wording and references stay unchanged for the reviewer", () => {
  const text = "﴿قل هو الله واحد﴾ [الإخلاص: 2].";
  const f = finding(text, "قل هو الله واحد", {
    status: "reference_mismatch", cited_reference: "الإخلاص: 2", needs_scholar_review: true,
  });
  const result = buildCorrected(text, [f], { f1: "approve" });
  assert.equal(result.changed, 0);
  assert.equal(result.flagged, 1);
  assert.equal(result.segments.map((s) => s.text).join(""), "﴿قل هو الله واحد﴾ [الإخلاص: 2] [1].");
});

test("semantic matches never replace wording or add a reference automatically", () => {
  const text = "﴿ترجمة تحتاج مراجعة﴾.";
  for (const status of ["matches_source", "wording_differs", "reference_mismatch"] as const) {
    const f = finding(text, "ترجمة تحتاج مراجعة", {
      status, cited_reference: null, evidence: [{ ...evidence(), match_type: "semantic" }],
    });
    const result = buildCorrected(text, [f], { f1: "approve" });
    assert.equal(result.changed, 0);
    assert.equal(result.added, 0);
    assert.equal(result.flagged, 1);
    assert.equal(result.segments.map((s) => s.text).join(""), "﴿ترجمة تحتاج مراجعة﴾ [1].");
  }
});

test("offset conversion handles end boundaries and rejects invalid spans", () => {
  assert.deepEqual(toUtf16Span("🌙📖abc", { start: 2, end: 5 }), { start: 4, end: 7 });
  assert.deepEqual(toUtf16Span("🌙", { start: 1, end: 1 }), { start: 2, end: 2 });
  for (const span of [{ start: -1, end: 1 }, { start: 2, end: 1 }, { start: 0, end: 20 }, { start: 0.5, end: 1 }])
    assert.equal(toUtf16Span("🌙abc", span), null);
});

test("corrections stay pending by default, and keeping the original preserves its warning", () => {
  const text = "﴿قل هو الله واحد﴾ [الإخلاص: 1].";
  const f = finding(text, "قل هو الله واحد");
  for (const decisions of [{}, { f1: "keep" }] as ReviewDecisions[]) {
    const c = buildCorrected(text, [f], decisions);
    assert.equal(c.changed, 0);
    assert.equal(c.segments.map((s) => s.text).join(""), "﴿قل هو الله واحد﴾ [الإخلاص: 1] [1].");
    assert.equal(c.proposals.length, 1);
    assert.equal(c.flagged, 1);
    assert.equal(c.pending, decisions.f1 ? 0 : 1);
  }
});

test("approval affects only the chosen quotation and can be undone without losing the original", () => {
  const quote = "قل هو الله واحد";
  const text = `🌙 ﴿${quote}﴾ [الإخلاص: 1]. ثم ﴿${quote}﴾ [الإخلاص: 1].`;
  const first = finding(text, quote);
  const secondStart = Array.from(text.slice(0, text.lastIndexOf(quote))).length;
  const second = { ...first, id: "f2", span: { start: secondStart, end: secondStart + Array.from(quote).length } };
  const c = buildCorrected(text, [first, second], { f2: "approve" });
  assert.equal(c.changed, 1);
  assert.equal(c.pending, 1);
  assert.equal(c.segments.filter((s) => s.kind === "wording").length, 1);
  assert.equal(c.proposals.length, 2);
  assert.ok(c.segments.map((s) => s.text).join("").startsWith(`🌙 ﴿${quote}﴾`));
  assert.equal(buildCorrected(text, [first, second], {}).changed, 0);
});

test("a missing citation is proposed but is added only after approval", () => {
  const text = "﴿قل هو الله أحد﴾.";
  const f = finding(text, "قل هو الله أحد", { status: "matches_source", cited_reference: null });
  assert.equal(buildCorrected(text, [f]).added, 0);
  const c = buildCorrected(text, [f], { f1: "approve" });
  assert.equal(c.added, 1);
  assert.equal(c.segments.map((s) => s.text).join(""), "﴿قُلْ هُوَ اللَّهُ أَحَدٌ﴾ [سورة الإخلاص: 1] [1].");
});

test("overlapping findings and mismatched scripture types cannot be approved automatically", () => {
  const text = "﴿قل هو الله واحد﴾ [الإخلاص: 1].";
  const first = finding(text, "قل هو الله واحد");
  const second = { ...first, id: "f2", span: { start: first.span!.start + 3, end: first.span!.end } };
  const overlap = buildCorrected(text, [first, second], { f1: "approve", f2: "approve" });
  assert.equal(overlap.proposals.length, 0);
  assert.equal(overlap.changed, 0);
  const wrongType = buildCorrected(text, [{ ...first, type: "hadith", status: "reference_mismatch" }], { f1: "approve" });
  assert.equal(wrongType.proposals.length, 0);
  assert.equal(wrongType.changed, 0);
});

test("suggested mode includes source proposals by default and creates a clean copy", () => {
  const text = "🌙 ﴿قل هو الله واحد﴾ [الإخلاص: 1].";
  const f = finding(text, "قل هو الله واحد");
  const c = buildCorrected(text, [f], {}, "suggested");
  assert.equal(c.changed, 1);
  assert.equal(c.text, "🌙 ﴿قُلْ هُوَ اللَّهُ أَحَدٌ﴾ [سورة الإخلاص: 1].");
  assert.ok(c.plain.includes("[1]"));
  assert.ok(c.notes[0].lines.some((line) => line.includes("ليس اعتمادًا بشريًا")));
  assert.equal(buildCorrected(text, [f], { f1: "keep" }, "suggested").text, text);
});

test("clean suggested copy retains added source references without numbered report notes", () => {
  const text = "﴿قل هو الله أحد﴾.";
  const f = finding(text, "قل هو الله أحد", { status: "matches_source", cited_reference: null });
  assert.equal(buildCorrected(text, [f], {}, "suggested").text, "﴿قُلْ هُوَ اللَّهُ أَحَدٌ﴾ [سورة الإخلاص: 1].");
});

test("suggested mode leaves uncertain text untouched", () => {
  const text = "﴿قل هو الله واحد﴾ [الإخلاص: 1].";
  const f = finding(text, "قل هو الله واحد", { needs_scholar_review: true });
  const c = buildCorrected(text, [f], { f1: "approve" }, "suggested");
  assert.equal(c.text, text);
  assert.equal(c.proposals.length, 0);
  assert.equal(c.flagged, 1);
});

test("Quran references have a consistent surah label without duplicated prefixes or brackets", () => {
  for (const input of ["البقرة:256", "سورة البقرة: 256", "[سورة البقرة: 256]", "(البقرة : 256)"])
    assert.equal(formatQuranReference(input), "سورة البقرة: 256");
  assert.equal(formatQuranReference("البقرة: ٢٥٥ - ٢٥٦"), "سورة البقرة: ٢٥٥–٢٥٦");
  assert.equal(evidenceReference({ ...evidence(), collection: "muslim", reference: "صحيح مسلم 1" }), "صحيح مسلم 1");
});

test("verified Arabic verses use Quran brackets and a formal reference even when wording is correct", () => {
  const quote = "قل هو الله أحد";
  for (const wrapped of [quote, `«${quote}»`, `“${quote}”`, `"${quote}"`, `(${quote})`, `﴿${quote}﴾`]) {
    const text = `🌙 قال تعالى: ${wrapped} [الإخلاص: 1].`;
    const f = finding(text, quote, { status: "matches_source", evidence: [{ ...evidence(), match_type: "exact" }] });
    const c = buildCorrected(text, [f], {}, "suggested");
    assert.equal(c.text, "🌙 قال تعالى: ﴿قُلْ هُوَ اللَّهُ أَحَدٌ﴾ [سورة الإخلاص: 1].");
    assert.equal(buildCorrected(text, [f], { f1: "keep" }, "suggested").text, text);
  }
});

test("corrected unbracketed verses also receive their missing source reference", () => {
  const text = "قال تعالى: قل هو الله واحد.";
  const f = finding(text, "قل هو الله واحد", { cited_reference: null });
  const c = buildCorrected(text, [f], {}, "suggested");
  assert.equal(c.text, "قال تعالى: ﴿قُلْ هُوَ اللَّهُ أَحَدٌ﴾ [سورة الإخلاص: 1].");
  assert.equal(c.added, 1);
});

test("already formal verses stay unchanged and source translations are not decorated as Arabic verses", () => {
  const text = "﴿قُلْ هُوَ اللَّهُ أَحَدٌ﴾ [سورة الإخلاص: 1].";
  const f = finding(text, "قُلْ هُوَ اللَّهُ أَحَدٌ", {
    status: "matches_source", cited_reference: "سورة الإخلاص: 1", evidence: [{ ...evidence(), match_type: "exact" }],
  });
  assert.equal(buildCorrected(text, [f], {}, "suggested").proposals.length, 0);
  const translated = "Say, He is Allah, One.";
  const translation = finding(translated, translated, {
    status: "matches_source", cited_reference: null,
    evidence: [{ ...evidence(), match_type: "semantic", highlight_lang: "en" }],
  });
  assert.equal(buildCorrected(translated, [translation], {}, "suggested").text, translated);
});

test("a verified partial verse keeps only the quoted excerpt in source script", () => {
  const text = "قال تعالى: لا إكراه في الدين.";
  const source = "لَآ إِكۡرَاهَ فِي ٱلدِّينِۖ قَد تَّبَيَّنَ ٱلرُّشۡدُ مِنَ ٱلۡغَيِّ";
  const excerpt = "لَآ إِكۡرَاهَ فِي ٱلدِّينِۖ";
  const f = finding(text, "لا إكراه في الدين", {
    status: "matches_source", cited_reference: null,
    evidence: [{ ...evidence(source, excerpt), reference: "البقرة: 256", match_type: "partial" }],
  });
  assert.equal(buildCorrected(text, [f], {}, "suggested").text, "قال تعالى: ﴿لَآ إِكۡرَاهَ فِي ٱلدِّينِ﴾ [سورة البقرة: 256].");
});
