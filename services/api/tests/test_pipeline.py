import asyncio

from app.pipeline import Pipeline
from app.schemas import ReferenceStatus
from app.store import MemoryStore


def run(pipeline, text):
    return asyncio.run(pipeline.verify(text, debug=True))


def by_quote(resp, fragment):
    return next(f for f in resp.findings if fragment in f.quoted_text)


def test_correct_quran_reference(pipeline):
    resp = run(pipeline, "قال تعالى: ﴿قل هو الله أحد﴾ [الإخلاص: 1]")
    f = resp.findings[0]
    assert f.status == ReferenceStatus.MATCHES_SOURCE
    assert f.evidence[0].reference == "الإخلاص: 1"
    assert f.evidence[0].context_after is not None  # next ayah shown for context


def test_hadith_reciting_the_verse_does_not_compete_with_the_quran(pipeline):
    resp = run(pipeline, "قال تعالى: ﴿قل هو الله أحد﴾ [الإخلاص: 1]")
    f = resp.findings[0]
    assert f.status == ReferenceStatus.MATCHES_SOURCE
    assert not f.needs_scholar_review
    assert f.suggested_reference == "الإخلاص: 1"
    assert all(e.collection == "quran" for e in f.evidence)


def test_wrong_ayah_number(pipeline):
    resp = run(pipeline, "قال تعالى: ﴿قل هو الله أحد﴾ [الإخلاص: 3]")
    f = resp.findings[0]
    assert f.status == ReferenceStatus.REFERENCE_MISMATCH
    assert f.suggested_reference == "الإخلاص: 1"


def test_hadith_with_wrong_collection(pipeline):
    resp = run(pipeline, "قال رسول الله ﷺ: «الطهور شطر الإيمان» (رواه البخاري).")
    f = resp.findings[0]
    assert f.status == ReferenceStatus.REFERENCE_MISMATCH
    assert "صحيح مسلم" in f.suggested_reference


def test_hadith_wording_differs(pipeline):
    resp = run(pipeline, "قال رسول الله ﷺ: «إنما الأعمال بالنيات الصادقة وإنما لكل امرئ ما نوى».")
    f = resp.findings[0]
    assert f.status == ReferenceStatus.WORDING_DIFFERS
    assert any(d.op == "insert" for d in f.diff)


def test_not_found_is_never_called_fabricated(pipeline):
    resp = run(pipeline, "قال رسول الله ﷺ: «النظافة من الإيمان».")
    f = resp.findings[0]
    assert f.status == ReferenceStatus.NOT_FOUND
    assert any("لا يعني" in n for n in f.notes)


def test_hadith_presented_as_quran(pipeline):
    resp = run(pipeline, "قال تعالى: «إنما الأعمال بالنيات».")
    f = resp.findings[0]
    assert f.status == ReferenceStatus.REFERENCE_MISMATCH


def test_conflicting_gradings_go_to_scholar_review(pipeline):
    resp = run(pipeline, "قال رسول الله ﷺ: «من حسن إسلام المرء تركه ما لا يعنيه».")
    f = resp.findings[0]
    assert f.needs_scholar_review
    assert {g.category for g in f.gradings} == {"accepted", "weak"}
    assert any(g.scholar_ar == "الألباني" for g in f.gradings)


def test_summary_counts_and_run_log(settings, retriever):
    store = MemoryStore()
    p = Pipeline(settings, retriever, store, llm=None)
    resp = run(p, "قال تعالى: ﴿قل هو الله أحد﴾ [الإخلاص: 1]\nقال رسول الله ﷺ: «النظافة من الإيمان».")
    assert resp.summary.total == 2
    assert resp.summary.by_status["matches_source"] == 1
    assert len(store.runs) == 1 and "text" not in store.runs[0]


class FakeLLM:
    model = "fake"

    def __init__(self, verdict):
        self.verdict = verdict

    async def extract_items(self, text):
        return []

    async def adjudicate(self, quote, candidates):
        return self.verdict


def test_translated_hadith_reference_is_not_judged_from_english_wording(pipeline):
    # Bukhari 1's English text matches; the author cites Muslim. Translations differ between books,
    # so this must go to review, not be called a wrong reference.
    resp = run(pipeline, 'The Prophet (ﷺ) said: "Actions are judged by intentions" (Sahih Muslim).')
    f = resp.findings[0]
    assert f.status != ReferenceStatus.REFERENCE_MISMATCH
    assert f.needs_scholar_review


def test_translated_verse_without_llm_shows_the_cited_ayah_unverified(pipeline):
    resp = run(pipeline, 'The Quran says: "Say, He is Allah, the One" (112:1).')
    f = next(x for x in resp.findings if "One" in x.quoted_text) if resp.findings else None
    if f is None:  # rules only catch hadith markers in English; build the item directly
        from app.extract import ExtractedItem
        from app.schemas import ItemType, Span

        item = ExtractedItem("Say, He is Allah, the One", ItemType.QURAN, cited_reference="112:1", span=Span(start=0, end=1))
        f = asyncio.run(pipeline._check("f1", item, None))
    assert f.status == ReferenceStatus.OUT_OF_SCOPE
    assert f.evidence[0].reference == "الإخلاص: 1"


def test_translated_verse_with_verified_llm_verdict(settings, retriever):
    from app.extract import ExtractedItem
    from app.schemas import ItemType, Span

    llm = FakeLLM({"decision": "same_text", "passage_id": 1, "supporting_excerpt": "قُلْ هُوَ اللَّهُ أَحَدٌ", "rationale": ""})
    p = Pipeline(settings, retriever, MemoryStore(), llm)
    item = ExtractedItem("Say, He is Allah, the One", ItemType.QURAN, cited_reference="112:1", span=Span(start=0, end=1))
    f = asyncio.run(p._check("f1", item, None))
    assert f.status == ReferenceStatus.MATCHES_SOURCE
    assert f.evidence[0].reference == "الإخلاص: 1"


def test_llm_verdict_with_invented_excerpt_is_rejected(settings, retriever):
    llm = FakeLLM({"decision": "same_meaning", "passage_id": 11, "supporting_excerpt": "نص لا يوجد في المصدر", "rationale": ""})
    p = Pipeline(settings, retriever, MemoryStore(), llm)
    resp = run(p, "قال رسول الله ﷺ: «الطهارة نصف الدين».")
    f = resp.findings[0]
    assert f.status == ReferenceStatus.NOT_FOUND
    assert f.needs_scholar_review


def test_llm_verdict_with_verified_excerpt_is_used(settings, retriever):
    llm = FakeLLM({"decision": "same_meaning", "passage_id": 11, "supporting_excerpt": "الطُّهُورُ شَطْرُ الإِيمَانِ", "rationale": ""})
    p = Pipeline(settings, retriever, MemoryStore(), llm)
    resp = run(p, "قال رسول الله ﷺ: «الطهارة نصف الدين».")
    f = resp.findings[0]
    assert f.status == ReferenceStatus.WORDING_DIFFERS
    assert f.evidence[0].collection == "muslim"
