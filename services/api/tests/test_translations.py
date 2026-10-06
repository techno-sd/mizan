"""Verses quoted in other languages, compared word for word with the approved QuranEnc translation in that language."""

import asyncio

import pytest

from app.config import Settings
from app.extract import ExtractedItem
from app.language import detect_language
from app.pipeline import Pipeline
from app.retrieve import InMemoryRetriever, Passage
from app.schemas import Finding, ItemType, ReferenceStatus
from app.store import MemoryStore


@pytest.mark.parametrize("text,lang", [
    ("Nul ne doit être contraint à embrasser la foi. Le droit chemin s'est clairement distingué", "fr"),
    ("No se puede forzar a nadie a creer en la religión: la verdad es claramente distinguible de la falsedad", "es"),
    ("Es gibt keinen Zwang im Glauben. Der richtige Weg ist nun klar unterschieden von dem Irrweg", "de"),
    ("Tidak ada paksaan dalam (menganut) agama (Islam), sesungguhnya telah jelas (perbedaan) antara jalan yang benar", "id"),
    ("Dinde zorlama yoktur. Hak yol, bâtıl yoldan ayrılmıştır ve bu için", "tr"),
    ("دین کے بارے میں کوئی زبردستی نہیں، ہدایت ضلالت سے روشن ہوچکی ہے", "ur"),
    ("لا إكراه في الدين قد تبين الرشد من الغي", "ar"),
    ("There is no compulsion in religion. The right course has become clear from the wrong", "en"),
])
def test_language_is_detected(text, lang):
    assert detect_language(text) == lang


AYAH = Passage(id=1, collection="quran", kind="quran", book=2, number=256, numbering_scheme=None,
               text_ar="لَآ إِكۡرَاهَ فِي ٱلدِّينِۖ قَد تَّبَيَّنَ ٱلرُّشۡدُ مِنَ ٱلۡغَيِّۚ")
NEXT = Passage(id=2, collection="quran", kind="quran", book=2, number=257, numbering_scheme=None,
               text_ar="ٱللَّهُ وَلِيُّ ٱلَّذِينَ ءَامَنُواْ")
FR = "Nul ne doit être contraint à embrasser la foi. Le droit chemin s’est en effet clairement distingué de la voie de l’égarement."
UR = "دین کے بارے میں کوئی زبردستی نہیں، ہدایت ضلالت سے روشن ہوچکی ہے"


def check(quote, cited, translations):
    r = InMemoryRetriever([AYAH, NEXT])
    r.translations = translations
    p = Pipeline(Settings(_env_file=None), r, MemoryStore(), llm=None)
    f = Finding(id="f1", type=ItemType.QURAN, span=None, quoted_text=quote, cited_reference=cited,
                status=ReferenceStatus.NOT_FOUND)
    return asyncio.run(p._check_translated_verse(f, ExtractedItem(quote, ItemType.QURAN, cited_reference=cited), None))


def test_french_verse_matching_the_approved_translation_is_certain():
    f = check("Nul ne doit être contraint à embrasser la foi", "2:256", {("fr", 2, 256): ("french_rashid", FR)})
    assert f.status == ReferenceStatus.MATCHES_SOURCE
    assert not f.needs_scholar_review
    assert f.evidence[0].translation_lang == "fr" and "الفرنسية" in f.evidence[0].translation_label
    assert f.suggested_reference.endswith("256")


def test_urdu_verse_is_found_without_a_reference_and_a_wrong_number_is_reported():
    f = check(UR, "[البقرة: 286]", {("ur", 2, 256): ("urdu_junagarhi", UR)})
    assert f.status == ReferenceStatus.REFERENCE_MISMATCH
    assert f.suggested_reference.endswith("256")


def test_another_translators_wording_falls_back_to_the_meaning_check():
    f = check("Il n'y a pas de contrainte en religion", "2:256", {("fr", 2, 256): ("french_rashid", FR)})
    assert f.status != ReferenceStatus.MATCHES_SOURCE or f.needs_scholar_review
    assert not any(e.translation_lang for e in f.evidence)
