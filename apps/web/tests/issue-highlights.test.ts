import assert from "node:assert/strict";
import { test } from "node:test";
import { issueHighlights } from "../src/lib/issue-highlights";
import type { Evidence, Finding } from "../src/lib/types";

function finding(text: string, quotation: string, overrides: Partial<Finding> = {}): Finding {
  const start = Array.from(text.slice(0, text.indexOf(quotation))).length;
  return {
    id: "f1", type: "quran", quoted_text: quotation,
    span: { start, end: start + Array.from(quotation).length }, attributed_to: null,
    cited_reference: "البقرة: 265", status: "reference_mismatch", needs_scholar_review: false,
    review_reasons: [], evidence: [], nearest: null, gradings: [], diff: [],
    suggested_reference: "البقرة: 256", notes: [], ...overrides,
  };
}

const colored = (text: string, findings: Finding[]) => issueHighlights(text, findings)
  .filter((item) => item.className !== "finding-mark-plain")
  .map((item) => ({ text: text.slice(item.span.start, item.span.end), color: item.className }));

test("only the incorrect Quran citation is yellow, preserving diacritics and emoji offsets", () => {
  const text = "🌙 قال تعالى: ﴿لَا إِكْرَاهَ فِي الدِّينِ﴾ [البقرة: 265].";
  assert.deepEqual(colored(text, [finding(text, "لَا إِكْرَاهَ فِي الدِّينِ")]), [
    { text: "[البقرة: 265]", color: "mark-amber" },
  ]);
});

test("hadith source errors highlight the parenthesized attribution rather than the quotation", () => {
  const text = "قال رسول الله ﷺ: «إن الله لا ينظر إلى صوركم» (رواه البخاري).";
  assert.deepEqual(colored(text, [finding(text, "إن الله لا ينظر إلى صوركم", {
    type: "hadith", cited_reference: "رواه البخاري",
  })]), [{ text: "(رواه البخاري)", color: "mark-amber" }]);
});

test("brackets with inner spaces and citations already included in a quote span are located", () => {
  for (const text of ["﴿لا إكراه في الدين﴾ [ البقرة: 265 ].", "لا إكراه في الدين [البقرة: 265]."]) {
    const quotation = text.startsWith("﴿") ? "لا إكراه في الدين" : "لا إكراه في الدين [البقرة: 265]";
    assert.equal(colored(text, [finding(text, quotation)])[0].text, text.includes("[ ") ? "[ البقرة: 265 ]" : "[البقرة: 265]");
  }
});

test("an unlocatable citation does not highlight a later quotation's reference or the correct verse", () => {
  const text = "﴿لا إكراه في الدين﴾. ثم اقتباس آخر [البقرة: 265].";
  const f = finding(text, "لا إكراه في الدين");
  assert.deepEqual(colored(text, [f]), []);
  assert.equal(issueHighlights(text, [f])[0].className, "finding-mark-plain");
});

test("wording differences highlight only the added phrase, including original diacritics", () => {
  const quote = "لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه مِنَ الخيرِ";
  const text = `قال النبي ﷺ: «${quote}» (متفق عليه).`;
  const f = finding(text, quote, { type: "hadith", status: "wording_differs", cited_reference: "متفق عليه", diff: [
    { op: "equal", text: "لا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ" },
    { op: "insert", text: "مِنَ الخيرِ" },
  ] });
  assert.deepEqual(colored(text, [f]), [{ text: "مِنَ الخيرِ", color: "mark-amber" }]);
});

test("equal diff operations disambiguate repeated words and separate changed ranges", () => {
  const text = "🌙 «خير للناس خير للجميع خير»";
  const f = finding(text, "خير للناس خير للجميع خير", { status: "wording_differs", diff: [
    { op: "equal", text: "خير للناس" }, { op: "insert", text: "خير" },
    { op: "equal", text: "للجميع" }, { op: "insert", text: "خير" },
  ] });
  const highlights = issueHighlights(text, [f]);
  assert.deepEqual(colored(text, [f]).map((item) => item.text), ["خير", "خير"]);
  assert.equal(highlights[0].span.start, text.indexOf("خير", text.indexOf("للناس")));
  assert.equal(highlights[1].span.start, text.lastIndexOf("خير"));
});

test("missing source words and ambiguous repeated phrases never fabricate a precise issue location", () => {
  for (const diff of [
    [{ op: "delete" as const, text: "كلمة ناقصة" }],
    [{ op: "insert" as const, text: "خير" }],
  ]) {
    const text = "«أحب خير الناس ثم خير العمل»";
    assert.deepEqual(colored(text, [finding(text, "أحب خير الناس ثم خير العمل", { status: "wording_differs", diff })]), []);
  }
});

test("a variant with a wrong citation highlights both the changed word and citation", () => {
  const text = "﴿قل هو الله واحد﴾ [الإخلاص: 2].";
  assert.deepEqual(colored(text, [finding(text, "قل هو الله واحد", {
    cited_reference: "الإخلاص: 2", evidence: [{ match_type: "variant" } as Evidence],
    diff: [{ op: "equal", text: "قل هو الله" }, { op: "delete", text: "أحد" }, { op: "insert", text: "واحد" }],
  })]), [{ text: "واحد", color: "mark-amber" }, { text: "[الإخلاص: 2]", color: "mark-amber" }]);
});

test("clean matches stay uncolored and invalid spans do not highlight unrelated text", () => {
  const text = "﴿لا إكراه في الدين﴾ [البقرة: 256].";
  assert.deepEqual(colored(text, [finding(text, "لا إكراه في الدين", { status: "matches_source", cited_reference: "البقرة: 256" })]), []);
  assert.deepEqual(issueHighlights(text, [finding(text, "لا إكراه في الدين", { span: { start: 0, end: 999 } })]), []);
});
