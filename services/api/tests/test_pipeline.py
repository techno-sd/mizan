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
