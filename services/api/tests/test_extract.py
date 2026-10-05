from app.extract import detect_rules, locate
from app.schemas import ItemType


def test_quran_brackets_with_reference():
    text = "قال تعالى: ﴿قل هو الله أحد﴾ [الإخلاص: 1] وهذا أصل التوحيد."
    items = detect_rules(text)
    assert len(items) == 1
    it = items[0]
    assert it.type == ItemType.QURAN
    assert it.quoted_text == "قل هو الله أحد"
    assert it.cited_reference == "الإخلاص: 1"
    assert text[it.span.start : it.span.end] == "قل هو الله أحد"


def test_hadith_marker_with_quotes_and_reference():
    text = "قال رسول الله ﷺ: «إنما الأعمال بالنيات» (رواه البخاري). ثم نكمل."
    items = detect_rules(text)
    assert len(items) == 1
    assert items[0].type == ItemType.HADITH
    assert items[0].quoted_text == "إنما الأعمال بالنيات"
    assert items[0].cited_reference == "رواه البخاري"


def test_quote_right_after_the_honorific():
    text = "ومن جميل الأخلاق ما أوصى به النبي ﷺ: «اتق الله حيثما كنت» (رواه الترمذي)."
    items = detect_rules(text)
    assert len(items) == 1
    assert items[0].quoted_text == "اتق الله حيثما كنت"
    assert items[0].cited_reference == "رواه الترمذي"


def test_explicit_marker_type_wins_over_model_type():
    from app.extract import ExtractedItem, merge_items
    from app.schemas import Span

    text = "قال تعالى: «لما خلق الله الخلق كتب في كتابه»"
    rules = detect_rules(text)
    assert rules[0].type == ItemType.QURAN
    llm = [ExtractedItem("لما خلق الله الخلق كتب في كتابه", ItemType.HADITH, span=Span(start=12, end=43), origin="llm")]
    merged = merge_items(llm, rules)
    assert len(merged) == 1 and merged[0].type == ItemType.QURAN


def test_hadith_qudsi_framing_is_not_a_quran_claim():
    text = "وفي الحديث القدسي قال تعالى: «يا عبادي إني حرمت الظلم على نفسي»"
    items = detect_rules(text)
    assert items[0].type == ItemType.HADITH


def test_english_marker():
    text = 'The Prophet (ﷺ) said: "Actions are judged by intentions" (Bukhari 1).'
    items = detect_rules(text)
    assert len(items) == 1 and items[0].cited_reference == "Bukhari 1"


def test_locate_exact_normalized_and_fuzzy():
    text = "قال: «إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ»"
    assert locate("إِنَّمَا الأَعْمَالُ", text) is not None
    span = locate("انما الاعمال بالنيات", text)
    assert text[span.start : span.end].startswith("إِنَّمَا")
    assert locate("كلام غير موجود اطلاقا في النص", text) is None
