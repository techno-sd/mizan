import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReviewReport } from "../src/lib/review-report";
import type { VerifyResponse } from "../src/lib/types";

function result(): VerifyResponse {
  return {
    api_version: "1", pipeline_version: "0.2.1", run_id: "run-123", corpus_version: "test-corpus",
    corpus_scope: ["QuranEnc"], llm_used: false,
    summary: { total: 1, by_status: { matches_source: 0, wording_differs: 1, reference_mismatch: 0, not_found: 0, out_of_scope: 0 }, needs_scholar_review: 0 },
    trace: null, findings: [{
      id: "f1", type: "quran", span: { start: 0, end: 3 }, quoted_text: "قال", attributed_to: null,
      cited_reference: null, status: "wording_differs", needs_scholar_review: false, review_reasons: [],
      nearest: null, gradings: [], diff: [], suggested_reference: "الإخلاص: 1", notes: [],
      evidence: [{
        passage_id: 1, collection: "quran", collection_label: "القرآن", reference: "الإخلاص: 1",
        number: 1, numbering_scheme: null, text: "قل", text_en: null, url: "https://example.com/source",
        similarity: 80, match_type: "variant", context_before: null, context_after: null,
        highlight: { start: 0, end: 2 }, highlight_lang: "ar", takhrij: null,
        source_id: "quranenc", source_label: "QuranEnc", source_url: "", source_approved: true,
      }],
    }],
  };
}

test("report records release metadata, original text, source evidence, and the review decision", () => {
  const html = buildReviewReport("قال", result(), { f1: "approve" }, "2026-10-06T12:00:00Z");
  for (const expected of ["run-123", "0.2.1", "test-corpus", "2026-10-06T12:00:00Z", "QuranEnc", "الإخلاص: 1", "اختار المراجع تضمين الاقتراح", "قال", "قل", "قواعد فقط", "طباعة / حفظ PDF"])
    assert.ok(html.includes(expected), expected);
});

test("default suggestions, excluded and blocked findings are accurately described", () => {
  assert.ok(buildReviewReport("قال", result(), {}, "now").includes("اقتراح مضمن افتراضيًا؛ ليس اعتمادًا بشريًا"));
  assert.ok(buildReviewReport("قال", result(), { f1: "keep" }, "now").includes("أبقى المراجع الأصل"));
  const uncertain = result();
  uncertain.findings[0].needs_scholar_review = true;
  const html = buildReviewReport("قال", uncertain, { f1: "approve" }, "now");
  assert.ok(html.includes("تحتاج مراجعة مختص"));
  assert.ok(!html.includes('<p class="decision"><strong>خيار الاقتراح:</strong> اختار المراجع تضمين الاقتراح'));
});

test("report escapes text and metadata and rejects executable source links", () => {
  const r = result();
  r.findings[0].quoted_text = '<script>alert("quote")</script>';
  r.findings[0].evidence[0].url = "javascript:alert(1)";
  r.findings[0].evidence[0].text = '<img src=x onerror="alert(1)">';
  r.corpus_version = '<script>alert("meta")</script>';
  const html = buildReviewReport('<script>alert("document")</script>', r, {}, '<script>alert("date")</script>');
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img src="));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes('<script src='));
});

test("empty results do not imply that the document is safe", () => {
  const r = result();
  r.findings = [];
  assert.ok(buildReviewReport("كلام عام", r, {}, "now").includes("لا يعني ذلك سلامة جميع محتويات النص"));
});

test("exported suggestions and source headings use the formal Quran format", () => {
  const html = buildReviewReport("قال", result(), {}, "now");
  assert.ok(html.includes("﴿قل﴾ [سورة الإخلاص: 1]"));
  assert.ok(html.includes("<h3>سورة الإخلاص: 1</h3>"));
});
