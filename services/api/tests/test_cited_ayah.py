"""Verses found on the challenge set (eval/challenge.jsonl): the cited ayah is always compared, and a verse quoted
word for word is not credited to other ayat with similar wording."""

import asyncio

from app.config import Settings
from app.pipeline import Pipeline
from app.retrieve import InMemoryRetriever, Passage
from app.store import MemoryStore

AYAT = [
    (1, 12, 87, "يَٰبَنِيَّ ٱذۡهَبُواْ فَتَحَسَّسُواْ مِن يُوسُفَ وَأَخِيهِ وَلَا تَاْيۡـَٔسُواْ مِن رَّوۡحِ ٱللَّهِۖ إِنَّهُۥ لَا يَاْيۡـَٔسُ مِن رَّوۡحِ ٱللَّهِ إِلَّا ٱلۡقَوۡمُ ٱلۡكَٰفِرُونَ"),
    (2, 2, 286, "لَا يُكَلِّفُ ٱللَّهُ نَفۡسًا إِلَّا وُسۡعَهَاۚ لَهَا مَا كَسَبَتۡ وَعَلَيۡهَا مَا ٱكۡتَسَبَتۡۗ رَبَّنَا لَا تُؤَاخِذۡنَآ إِن نَّسِينَآ أَوۡ أَخۡطَأۡنَاۚ"),
    (3, 6, 152, "وَأَوۡفُواْ ٱلۡكَيۡلَ وَٱلۡمِيزَانَ بِٱلۡقِسۡطِۖ لَا نُكَلِّفُ نَفۡسًا إِلَّا وُسۡعَهَاۖ وَإِذَا قُلۡتُمۡ فَٱعۡدِلُواْ وَلَوۡ كَانَ ذَا قُرۡبَىٰۖ"),
]
# A hadith commentary that quotes the verse: the only thing search found in production.
HADITH = Passage(
    id=4, collection="bukhari", kind="hadith", book=60, number=3389, numbering_scheme=None,
    text_ar="قَالَتْ \u200f{\u200fلاَ تَيْأَسُوا مِنْ رَوْحِ اللَّهِ\u200f}\u200f مَعْنَاهُ الرَّجَاءُ",
)


def passages():
    return [
        Passage(id=i, collection="quran", kind="quran", book=s, number=a, numbering_scheme=None, text_ar=t)
        for i, s, a, t in AYAT
    ] + [HADITH]


class MissesVerses(InMemoryRetriever):
    """Search that misses the ayah, as the database did for its mushaf spelling."""

    async def search(self, query, kind, k):
        return [c for c in await super().search(query, kind, k) if c.passage.collection != "quran"]


def verify(text, retriever):
    p = Pipeline(Settings(_env_file=None), retriever, MemoryStore(), llm=None)
    return asyncio.run(p.verify(text)).findings[0]


def test_cited_ayah_is_compared_even_when_search_misses_it():
    f = verify("قال تعالى: ﴿ولا تيأسوا من رحمة الله﴾ [يوسف: 87].", MissesVerses(passages()))
    assert f.status.value == "wording_differs"  # «روح الله» in the mushaf
    assert f.suggested_reference == "يوسف: 87"


def test_exact_verse_lists_only_ayat_with_its_words():
    f = verify("قال تعالى: ﴿لا يكلف الله نفسا إلا وسعها﴾ [البقرة: 286].", InMemoryRetriever(passages()))
    assert f.status.value == "matches_source"
    assert f.suggested_reference == "البقرة: 286"


def test_the_two_sahihs_lead_among_equally_good_narrations():
    sunan = Passage(id=10, collection="ibnmajah", kind="hadith", book=12, number=2225, numbering_scheme=None,
                    text_ar="فَقَالَ لَعَلَّكَ غَشَشْتَهُ مَنْ غَشَّنَا فَلَيْسَ مِنَّا")
    muslim = Passage(id=11, collection="muslim", kind="hadith", book=1, number=101, numbering_scheme=None,
                     text_ar="مَنْ حَمَلَ عَلَيْنَا السِّلاَحَ فَلَيْسَ مِنَّا وَمَنْ غَشَّنَا فَلَيْسَ مِنَّا")
    f = verify("قال ﷺ: «من غشنا فليس منا» (رواه البخاري).", InMemoryRetriever([sunan, muslim]))
    assert f.status.value == "reference_mismatch"
    assert f.suggested_reference.startswith("صحيح مسلم 101")
