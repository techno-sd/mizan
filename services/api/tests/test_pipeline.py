import asyncio

from app.pipeline import Pipeline
from app.retrieve import InMemoryRetriever
from app.schemas import ReferenceStatus
from app.store import MemoryStore
from tests.conftest import PASSAGES


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


def test_changed_quran_alef_is_not_confirmed(pipeline):
    f = run(pipeline, "قال تعالى: ﴿قال هو الله أحد﴾ [الإخلاص: 1]").findings[0]
    assert f.status == ReferenceStatus.WORDING_DIFFERS
    assert any(d.op == "insert" and "قال" in d.text for d in f.diff)


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

    def __init__(self, verdict, locate=None):
        self.verdict = verdict
        self.locate = locate or {"original_text_ar": "", "locations": []}
        self.adjudicated: list[list[int]] = []

    async def extract_items(self, text):
        return []

    async def locate_sources(self, quote, item_type, cited_reference):
        return self.locate

    async def adjudicate(self, quote, candidates):
        self.adjudicated.append([c["id"] for c in candidates])
        if self.verdict is None:
            raise AssertionError("adjudicate should not be called")
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
    assert f.needs_scholar_review


# --- Claude proposes where a quote comes from; the database and the matcher decide ---------------------------


class BlindRetriever(InMemoryRetriever):
    """Search finds nothing (as for a paraphrase sharing no rare words with its source); lookups still work."""

    async def search(self, query, kind, k):
        return []


def _item(text, item_type, cited=None):
    from app.extract import ExtractedItem
    from app.schemas import ItemType, Span

    return ExtractedItem(text, ItemType(item_type), cited_reference=cited, span=Span(start=0, end=1))


def _locations(*locs):
    return {"original_text_ar": "", "locations": [{"collection": c, "book": b, "number": n} for c, b, n in locs]}


def test_proposed_location_is_matched_deterministically(settings):
    # Retrieval misses the hadith; Claude names Tirmidhi 2317; the exact text there makes it a plain match.
    llm = FakeLLM(None, _locations(("tirmidhi", 0, 2317)))
    p = Pipeline(settings, BlindRetriever(PASSAGES), MemoryStore(), llm)
    resp = run(p, "قال رسول الله ﷺ: «من حسن إسلام المرء تركه ما لا يعنيه» (رواه الترمذي).")
    f = resp.findings[0]
    assert f.status == ReferenceStatus.MATCHES_SOURCE
    assert f.evidence[0].reference.endswith("2317")
    assert llm.adjudicated == []  # no model judgment needed


def test_proposed_passage_reaches_adjudication(settings):
    llm = FakeLLM(
        {"decision": "same_meaning", "passage_id": 11, "supporting_excerpt": "الطُّهُورُ شَطْرُ الإِيمَانِ", "rationale": ""},
        _locations(("muslim", 0, 223)),
    )
    p = Pipeline(settings, BlindRetriever(PASSAGES), MemoryStore(), llm)
    resp = run(p, "قال رسول الله ﷺ: «الطهارة نصف الدين».")
    f = resp.findings[0]
    assert llm.adjudicated == [[11]]
    assert f.status == ReferenceStatus.WORDING_DIFFERS
    assert f.evidence[0].collection == "muslim"
    assert any(step.get("proposed") for step in resp.trace)


def test_proposed_original_wording_is_searched(settings, retriever):
    # Claude's recalled Arabic wording is a search query; its result is still matched against the user's quote.
    class SearchOnlyByWording(InMemoryRetriever):
        async def search(self, query, kind, k):
            return await super().search(query, kind, k) if "الطهور" in query else []

    llm = FakeLLM(
        {"decision": "same_meaning", "passage_id": 11, "supporting_excerpt": "الطهور شطر الايمان", "rationale": ""},
        {"original_text_ar": "الطهور شطر الإيمان", "locations": []},
    )
    p = Pipeline(settings, SearchOnlyByWording(PASSAGES), MemoryStore(), llm)
    f = run(p, "قال رسول الله ﷺ: «الطهارة نصف الدين».").findings[0]
    assert f.status == ReferenceStatus.WORDING_DIFFERS
    assert 11 in llm.adjudicated[0]


def test_saying_on_a_related_theme_stays_not_found(settings):
    # «النظافة من الإيمان» is not a hadith. Even if a related hadith is proposed, the adjudicator's "different" holds.
    llm = FakeLLM(
        {"decision": "different", "passage_id": 0, "supporting_excerpt": "", "rationale": ""},
        _locations(("muslim", 0, 223)),
    )
    p = Pipeline(settings, BlindRetriever(PASSAGES), MemoryStore(), llm)
    f = run(p, "قال رسول الله ﷺ: «النظافة من الإيمان».").findings[0]
    assert f.status == ReferenceStatus.NOT_FOUND
    assert f.evidence == []


def test_stock_phrase_excerpt_is_not_verification(settings):
    llm = FakeLLM(
        {"decision": "same_meaning", "passage_id": 11, "supporting_excerpt": "قال", "rationale": ""},
        _locations(("muslim", 0, 223)),
    )
    p = Pipeline(settings, BlindRetriever(PASSAGES), MemoryStore(), llm)
    f = run(p, "قال رسول الله ﷺ: «الطهارة نصف الدين».").findings[0]
    assert f.status == ReferenceStatus.NOT_FOUND
    assert f.needs_scholar_review


def test_invalid_proposals_are_ignored(settings):
    llm = FakeLLM(None, _locations(("quran", 0, 1), ("bukhari", 0, 0), ("muslim", 0, 999999)))
    p = Pipeline(settings, BlindRetriever(PASSAGES), MemoryStore(), llm)
    f = run(p, "قال رسول الله ﷺ: «كلام لا أصل له في الكتب».").findings[0]
    assert f.status == ReferenceStatus.NOT_FOUND


def test_translated_verse_without_reference_is_located(settings, retriever):
    llm = FakeLLM(
        {"decision": "same_text", "passage_id": 1, "supporting_excerpt": "قُلْ هُوَ اللَّهُ أَحَدٌ", "rationale": ""},
        _locations(("quran", 112, 1)),
    )
    p = Pipeline(settings, retriever, MemoryStore(), llm)
    f = asyncio.run(p._check("f1", _item("Say, He is Allah, the One", "quran"), None))
    assert f.status == ReferenceStatus.MATCHES_SOURCE
    assert f.suggested_reference == "الإخلاص: 1"


def test_translated_verse_with_wrong_reference(settings, retriever):
    llm = FakeLLM(
        {"decision": "same_text", "passage_id": 5, "supporting_excerpt": "إِنَّ أَكْرَمَكُمْ عِنْدَ اللَّهِ أَتْقَاكُمْ", "rationale": ""},
        _locations(("quran", 49, 13)),
    )
    p = Pipeline(settings, retriever, MemoryStore(), llm)
    item = _item("The most noble of you in the sight of Allah is the most righteous of you", "quran", "112:3")
    f = asyncio.run(p._check("f1", item, None))
    assert llm.adjudicated == [[3, 5]]  # the cited ayah and Claude's proposal, judged together
    assert f.status == ReferenceStatus.REFERENCE_MISMATCH
    assert f.suggested_reference == "الحجرات: 13"


def test_translated_verse_at_neighbouring_ayah_is_reviewed_not_mismatched(settings, retriever):
    llm = FakeLLM(
        {"decision": "same_text", "passage_id": 1, "supporting_excerpt": "قُلْ هُوَ اللَّهُ أَحَدٌ", "rationale": ""},
        _locations(("quran", 112, 1)),
    )
    p = Pipeline(settings, retriever, MemoryStore(), llm)
    f = asyncio.run(p._check("f1", _item("Say, He is Allah, the One", "quran", "112:2"), None))
    assert f.status == ReferenceStatus.MATCHES_SOURCE
    assert f.needs_scholar_review
