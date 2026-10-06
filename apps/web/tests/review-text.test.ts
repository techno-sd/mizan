import assert from "node:assert/strict";
import { test } from "node:test";
import { gradingSentence, referenceChange, reviewOnlyForRulings, reviewBreakdown, reviewComment, reviewCorrection, reviewOriginal, reviewPlainText, reviewQuotation, reviewText, verdict, wordingChange } from "../src/lib/review-text";
import type { Finding } from "../src/lib/types";

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "f1", type: "quran", span: { start: 0, end: Array.from("قل هو الله أحد").length }, quoted_text: "قل هو الله أحد", attributed_to: null,
    cited_reference: null, status: "matches_source", needs_scholar_review: false, review_reasons: [],
    evidence: [{ passage_id: 1, collection: "quran", collection_label: "القرآن", reference: "الإخلاص: 1", number: 1,
      numbering_scheme: null, text: "قل هو الله أحد", text_en: null, url: "https://quranenc.com/ar/browse/arabic_moyassar/112#1",
      similarity: 100, match_type: "exact", context_before: null, context_after: null, highlight: { start: 0, end: Array.from("قل هو الله أحد").length },
      highlight_lang: "ar", takhrij: null, source_id: "quranenc", source_label: "QuranEnc", source_url: "", source_approved: true }],
    nearest: null, gradings: [], diff: [], suggested_reference: null, notes: [], ...overrides,
  };
}

test("short quotations needing review never become a confident conversational verdict", () => {
  const f = finding({ needs_scholar_review: true, review_reasons: ["النص قصير جدًا للمطابقة الموثوقة."] });
  const reply = reviewText(f);
  assert.equal(reply.tone, "review");
  assert.ok(reply.text.includes("النص قصير جدًا"));
  assert.ok(!reply.text.includes("مطابق للنص"));
  assert.ok(reviewPlainText([f]).includes("المرجع المحتمل"));
});

test("semantic matches and missing evidence remain uncertain", () => {
  const f = finding();
  f.evidence[0].match_type = "semantic";
  assert.equal(reviewText(f).tone, "review");
  assert.ok(reviewText(f).text.includes("المطابقة بالمعنى"));
  assert.equal(reviewText(finding({ evidence: [] })).tone, "review");
});

test("unsupported and out-of-scope texts do not invent a source", () => {
  const absent = reviewText(finding({ status: "not_found", evidence: [] }));
  assert.ok(absent.text.includes("لا يعني أنه موضوع"));
  assert.equal(absent.reference, null);
  assert.ok(reviewText(finding({ status: "out_of_scope", evidence: [] })).text.includes("لم يُتحقّق منه"));
});

test("wrong scripture types are explained rather than confidently corrected", () => {
  const reply = reviewText(finding({ type: "hadith", status: "reference_mismatch" }));
  assert.equal(reply.tone, "review");
  assert.ok(reply.text.includes("آية وليس حديثًا"));
});

test("copied replies retain formal references, full quotations, and source links", () => {
  const quote = "نص طويل ".repeat(50).trim();
  const f = finding({ quoted_text: quote, status: "reference_mismatch", span: { start: 0, end: Array.from(quote).length } });
  f.evidence[0].text = quote;
  f.evidence[0].highlight = f.span;
  const text = reviewPlainText([f]);
  assert.ok(text.includes(quote));
  assert.ok(text.includes(`الصحيح: ﴿${quote}﴾ [سورة الإخلاص: 1]`));
  assert.ok(text.includes("https://quranenc.com/"));
  assert.ok(text.includes("مطابقة اللفظ لا تعني صحة الحديث"));
});

test("weak reported grading remains visible in the copied reply", () => {
  const f = finding({ gradings: [{ scholar: "reviewer", grade: "weak", scholar_ar: "المصدر", grade_ar: "ضعيف", source_label: "الموسوعة", source_approved: true, category: "weak" }] });
  const text = reviewPlainText([f]);
  assert.ok(text.includes("الحكم المنقول: ضعيف"));
  assert.ok(text.includes("راجعه قبل الاستشهاد"));
});

test("verified Quran quotes use source script while uncertain quotations preserve the original", () => {
  const f = finding();
  f.evidence[0].text = "قُلْ";
  f.evidence[0].highlight = { start: 0, end: 4 };
  assert.equal(reviewQuotation(f), "﴿قُلْ﴾");
  assert.equal(reviewQuotation({ ...f, needs_scholar_review: true }), "﴿قل هو الله أحد﴾");
});

test("overall commentary recommends reference fixes without clearing the entire document", () => {
  const comment = reviewComment([finding({ status: "reference_mismatch" })]);
  assert.ok(comment.overview.includes("تصحيح"));
  assert.ok(comment.advice.includes("صحّح الإحالات"));
  assert.ok(!comment.overview.includes("جاهز للنشر"));
});

test("overall commentary keeps uncertain and unchecked findings in view", () => {
  const comment = reviewComment([finding({ needs_scholar_review: true }), finding({ status: "out_of_scope", evidence: [] })]);
  assert.ok(comment.overview.includes("تحققًا إضافيًا"));
  assert.ok(comment.advice.includes("غير القاطعة"));
  assert.ok(comment.advice.includes("لم يُتحقّق منها"));
});

test("commentary on matching texts is limited to the loaded sources and missing references", () => {
  const comment = reviewComment([finding()]);
  assert.ok(comment.overview.includes("مصادر ميزان"));
  assert.ok(comment.advice.includes("المراجع الناقصة"));
});

test("empty commentary cannot imply that the text is safe", () => {
  assert.ok(reviewComment([]).advice.includes("لا يعني سلامة النص"));
});

test("the response preserves the full original verse and wrong reference before the formal correction", () => {
  const quote = "قل هو الله أحد";
  const document = `🌙 قال تعالى: ﴿${quote}﴾ [الإخلاص: 2].`;
  const start = Array.from(document.slice(0, document.indexOf(quote))).length;
  const f = finding({ status: "reference_mismatch", cited_reference: "الإخلاص: 2", span: { start, end: start + quote.length } });
  f.evidence[0].text = "قُلْ هُوَ اللَّهُ أَحَدٌ";
  f.evidence[0].highlight = { start: 0, end: Array.from(f.evidence[0].text).length };
  const original = reviewOriginal(f, document);
  assert.equal(original.text, `﴿${quote}﴾ [الإخلاص: 2]`);
  assert.equal(original.segments.map((segment) => segment.text).join(""), original.text);
  assert.deepEqual(original.segments.filter((segment) => segment.issue).map((segment) => segment.text), ["[الإخلاص: 2]"]);
  assert.equal(reviewCorrection(f), "﴿قُلْ هُوَ اللَّهُ أَحَدٌ﴾ [سورة الإخلاص: 1]");
  const copy = reviewPlainText([f], document);
  assert.ok(copy.indexOf("[الإخلاص: 2]") < copy.indexOf("الصحيح:"));
});

test("response quotations are not truncated at 160 characters", () => {
  const quote = "نص طويل ".repeat(50).trim();
  const document = `«${quote}» (رواه البخاري)`;
  const start = Array.from(document.slice(0, document.indexOf(quote))).length;
  const f = finding({ type: "hadith", status: "reference_mismatch", quoted_text: quote, cited_reference: "رواه البخاري", span: { start, end: start + quote.length } });
  assert.equal(reviewOriginal(f, document).text, document);
  assert.ok(!reviewOriginal(f, document).text.includes("…"));
});

test("response wording corrections follow the original highlighted changed word", () => {
  const document = "﴿قل هو الله واحد﴾ [الإخلاص: 1]";
  const f = finding({ quoted_text: "قل هو الله واحد", span: { start: 1, end: 16 }, status: "wording_differs", cited_reference: "الإخلاص: 1", diff: [
    { op: "equal", text: "قل هو الله" }, { op: "delete", text: "أحد" }, { op: "insert", text: "واحد" },
  ] });
  assert.equal(reviewOriginal(f, document).text, document);
  assert.deepEqual(reviewOriginal(f, document).segments.filter((segment) => segment.issue).map((segment) => segment.text), ["واحد"]);
  assert.equal(reviewCorrection(f), "﴿قل هو الله أحد﴾ [سورة الإخلاص: 1]");
});

test("uncertain, missing, and mismatched scripture types never receive a confident corrected line", () => {
  for (const f of [
    finding({ status: "reference_mismatch", needs_scholar_review: true }),
    finding({ status: "wording_differs", evidence: [] }),
    finding({ type: "hadith", status: "reference_mismatch" }),
    finding({ status: "not_found", evidence: [] }),
  ]) assert.equal(reviewCorrection(f), null);
  const semantic = finding({ status: "wording_differs" });
  semantic.evidence[0].match_type = "semantic";
  assert.equal(reviewCorrection(semantic), null);
});

test("English source corrections use the aligned source translation", () => {
  const f = finding({ type: "hadith", quoted_text: "old wording", status: "wording_differs" });
  f.evidence[0] = { ...f.evidence[0], collection: "muslim", collection_label: "صحيح مسلم", text_en: "Correct source wording", highlight_lang: "en", highlight: { start: 0, end: 22 } };
  assert.equal(reviewCorrection(f), "«Correct source wording» (رواه مسلم)");
});

test("each quote leads with a short verdict, and the summary counts verdicts", () => {
  assert.equal(verdict(finding({ status: "reference_mismatch" })).label, "الإحالة غير صحيحة");
  assert.equal(verdict(finding({ status: "not_found", evidence: [] })).label, "لم نجده");
  assert.equal(verdict(finding({ type: "hadith", status: "reference_mismatch" })).label, "آية لا حديث");
  const b = reviewBreakdown([finding(), finding({ status: "reference_mismatch" }), finding()]);
  assert.deepEqual(b.map((x) => [x.label, x.count]), [["الإحالة غير صحيحة", 1], ["مطابق للمصدر", 2]]);
});

test("the reply names the words that differ", () => {
  assert.equal(wordingChange([{ op: "equal", text: "لا يؤمن أحدكم" }, { op: "insert", text: "من الخير" }]), "في لفظك زيادة «من الخير» ليست في المصدر.");
  assert.equal(wordingChange([{ op: "equal", text: "قل هو الله" }, { op: "delete", text: "أحد" }, { op: "insert", text: "واحد" }]), "في لفظك «واحد» بدل «أحد».");
  assert.equal(wordingChange([{ op: "equal", text: "نص" }]), null);
});

test("a wrong reference says what was written and that the wording itself is right", () => {
  const f = finding({ status: "reference_mismatch", cited_reference: "[الإخلاص: 2]" });
  assert.equal(referenceChange(f), "ذكرتَ «الإخلاص: 2»، والصحيح «سورة الإخلاص: 1»؛ اللفظ نفسه مطابق للمصدر.");
  assert.equal(referenceChange(finding({ status: "reference_mismatch", needs_scholar_review: true })), null);
});

test("reported rulings fit in one sentence, naming who graded and through which source", () => {
  const weak = finding({ gradings: [
    { scholar: "Al-Albani", grade: "Very Daif", scholar_ar: "الألباني", grade_ar: "ضعيف جدًا", source_label: "مجموعة hadith-api", source_approved: false, category: "rejected" },
  ] });
  assert.equal(gradingSentence(weak), "الحكم المنقول: ضعيف جدًا عند الألباني (عبر مجموعة hadith-api، خارج الحزمة العلمية). راجعه قبل الاستشهاد به.");
  const mixed = finding({ needs_scholar_review: true, review_reasons: ["أحكام العلماء المنقولة على هذا الحديث متباينة."], gradings: [
    { scholar: "x", grade: "q", scholar_ar: "الموسوعة", grade_ar: "قال النووي: حديث حسن", source_label: "الموسوعة", source_approved: true, category: "accepted" },
    { scholar: "y", grade: "Daif", scholar_ar: "زبير علي زئي", grade_ar: "ضعيف", source_label: "hadith-api", source_approved: false, category: "weak" },
  ] });
  assert.equal(gradingSentence(mixed), "الأحكام المنقولة: قال النووي: حديث حسن (الموسوعة)، وضعيف عند زبير علي زئي. راجعه قبل الاستشهاد به.");
  assert.equal(reviewText(mixed).text, "مطابق للنص في المصدر، لكن الأحكام المنقولة فيه متباينة.");
  assert.ok(!reviewPlainText([mixed]).includes("المرجع المحتمل"));
});

test("a wrong reference stays the verdict when only the rulings differ, and each ruling names its book", () => {
  const f = finding({ type: "hadith", status: "reference_mismatch", cited_reference: "رواه البخاري", needs_scholar_review: true,
    review_reasons: ["أحكام العلماء المنقولة على هذا الحديث متباينة."], gradings: [
      { scholar: "a", grade: "Very Daif", scholar_ar: "الألباني", grade_ar: "ضعيف جدًا", source_label: "hadith-api", source_approved: false, reference: "سنن ابن ماجه 2225", category: "rejected" },
      { scholar: "b", grade: "Sahih", scholar_ar: "أحمد شاكر", grade_ar: "صحيح", source_label: "hadith-api", source_approved: false, reference: "صحيح مسلم 101", category: "accepted" },
    ] });
  f.evidence[0] = { ...f.evidence[0], collection: "ibnmajah", collection_label: "سنن ابن ماجه", reference: "سنن ابن ماجه 2225", match_type: "partial" };
  assert.ok(reviewOnlyForRulings(f));
  assert.equal(verdict(f).label, "الإحالة غير صحيحة");
  assert.equal(reviewText(f).tone, "fix");
  assert.equal(gradingSentence(f), "الأحكام المنقولة: ضعيف جدًا عند الألباني في سنن ابن ماجه 2225، وصحيح عند أحمد شاكر في صحيح مسلم 101. راجعه قبل الاستشهاد به.");
});
