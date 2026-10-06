import pytest

from app.align import compare
from app.schemas import MatchType
from tests.conftest import PASSAGES

BUKHARI_1 = next(p for p in PASSAGES if p.id == 10)


@pytest.mark.parametrize("quote", ["قال هو الله أحد", "قل هو الله واحد", "قل هو الله الأحد"])
def test_quran_letter_changes_are_not_exact_matches(quote):
    p = next(p for p in PASSAGES if p.id == 1)
    c = compare(quote, p, 92, 75)
    assert c.match_type == MatchType.VARIANT
    assert any(d.op != "equal" for d in c.diff)


def test_quran_alef_insertion_is_not_ignored_in_other_words():
    from app.retrieve import Passage

    p = Passage(100, "quran", "quran", 96, 5, None, "عَلَّمَ ٱلۡإِنسَٰنَ مَا لَمۡ يَعۡلَمۡ")
    c = compare("عالم الإنسان ما لم يعلم", p, 92, 75)
    assert c.match_type == MatchType.VARIANT


def test_source_vowel_marks_and_bare_rasm_are_supported():
    from app.retrieve import Passage

    p = Passage(101, "quran", "quran", 1, 1, None, "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ")
    assert compare("بسم الله الرحمن الرحيم", p, 92, 75).match_type == MatchType.EXACT
    assert compare(p.text_ar, p, 92, 75).match_type == MatchType.EXACT


def test_vocative_highlight_includes_both_original_tokens():
    from app.retrieve import Passage

    p = Passage(102, "quran", "quran", 49, 13, None, "يا أيها الناس")
    c = compare("يا أيها", p, 92, 75)
    start, end = c.highlight
    assert p.text_ar[start:end] == "يا أيها"


def test_exact_excerpt_inside_long_hadith_is_partial_match():
    c = compare("إنما الأعمال بالنيات", BUKHARI_1, 92, 75)
    assert c.similarity >= 92
    assert c.match_type == MatchType.PARTIAL  # the hadith also has an isnad and a second sentence


def test_highlight_points_at_the_matched_part_of_the_source():
    c = compare("إنما الأعمال بالنيات", BUKHARI_1, 92, 75)
    start, end = c.highlight
    assert BUKHARI_1.text_ar[start:end].startswith("إِنَّمَا")
    assert "حَدَّثَنَا" not in BUKHARI_1.text_ar[start:end]  # the isnad is not highlighted


def test_changed_wording_is_variant_with_diff():
    c = compare("إنما الأعمال بالنيات الصادقة وإنما لكل امرئ ما نوى", BUKHARI_1, 92, 75)
    assert c.match_type == MatchType.VARIANT
    ops = {d.op for d in c.diff}
    assert "insert" in ops  # "الصادقة" is only in the user's text
    inserted = " ".join(d.text for d in c.diff if d.op == "insert")
    assert "الصادقة" in inserted


def test_standard_spelling_matches_uthmani_mushaf_text():
    from app.retrieve import Passage

    # QuranEnc (King Fahd Complex) Uthmani text vs how writers type the verse.
    p = Passage(1, "quran", "quran", 49, 13, None,
                "يَٰٓأَيُّهَا ٱلنَّاسُ إِنَّا خَلَقۡنَٰكُم مِّن ذَكَرٖ وَأُنثَىٰ وَجَعَلۡنَٰكُمۡ شُعُوبٗا وَقَبَآئِلَ لِتَعَارَفُوٓاْۚ")
    c = compare("يا أيها الناس إنا خلقناكم من ذكر وأنثى وجعلناكم شعوبا وقبائل لتعارفوا", p, 92, 75)
    assert c.match_type in (MatchType.EXACT, MatchType.PARTIAL)
    q = Passage(2, "quran", "quran", 2, 43, None, "وَأَقِيمُواْ ٱلصَّلَوٰةَ وَءَاتُواْ ٱلزَّكَوٰةَ وَٱرۡكَعُواْ مَعَ ٱلرَّٰكِعِينَ")
    assert compare("وأقيموا الصلاة وآتوا الزكاة", q, 92, 75).match_type == MatchType.PARTIAL
    # Copied from a mushaf app without marks: «الصلوة» keeps the rasm.
    assert compare("وأقيموا ٱلصلوة وءاتوا ٱلزكوة", q, 92, 75).match_type == MatchType.PARTIAL
    # A changed word is still a difference.
    assert compare("وأقيموا الصلاة وآتوا الصدقة", q, 92, 75).match_type != MatchType.PARTIAL


def test_one_added_word_is_not_a_match():
    # Character similarity stays above 92 here; the word-level rule must still call it different.
    c = compare("إنما الأعمال دائما بالنيات وإنما لكل امرئ ما نوى", BUKHARI_1, 92, 75)
    assert c.match_type == MatchType.VARIANT
    assert any(d.op == "insert" and "دائما" in d.text for d in c.diff)


def test_honorifics_do_not_count_as_changes():
    c = compare("قال ﷺ إنما الأعمال بالنيات", BUKHARI_1, 92, 75)
    # "قال" is in the source isnad before the matn, "ﷺ" vs "صلى الله عليه وسلم" is ignored
    assert c.match_type in (MatchType.PARTIAL, MatchType.VARIANT)


def test_short_saying_does_not_latch_onto_a_different_text():
    from app.retrieve import Passage

    p = Passage(99, "abudawud", "hadith", 1, 4161, None, "قال رسول الله صلى الله عليه وسلم البذاذة من الإيمان")
    c = compare("النظافة من الإيمان", p, 92, 75)
    assert c.match_type is None


def test_unrelated_text_does_not_match():
    c = compare("اطلبوا العلم ولو في الصين", BUKHARI_1, 92, 75)
    assert c.match_type is None


def test_indexed_retriever_finds_the_hadith_and_its_neighbors():
    import asyncio

    from app.retrieve import IndexedRetriever

    r = IndexedRetriever(PASSAGES)
    hits = asyncio.run(r.search("إنما الأعمال بالنيات", None, 3))
    assert hits[0].passage.id == 10
    before, after = asyncio.run(r.neighbors(2))  # الصمد: previous and next ayah of surah 112
    assert before and after


def test_english_quote_compares_against_english_text():
    c = compare("Actions are judged by intentions", BUKHARI_1, 92, 75)
    assert c.lang == "en" and c.similarity >= 92


def test_quote_from_mid_sentence_drops_the_joining_waw():
    from app.retrieve import Passage
    p = Passage(id=1, collection="muslim", kind="hadith", book=1, number=101, numbering_scheme=None,
                text_ar="مَنْ حَمَلَ عَلَيْنَا السِّلاَحَ فَلَيْسَ مِنَّا وَمَنْ غَشَّنَا فَلَيْسَ مِنَّا")
    c = compare("من غشنا فليس منا", p, 92, 75)
    assert c.match_type is not None and c.match_type.value in ("exact", "partial")
    assert c.similarity == 100
