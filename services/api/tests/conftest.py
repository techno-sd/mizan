import pytest

from app.config import Settings
from app.pipeline import Pipeline
from app.retrieve import InMemoryRetriever, Passage
from app.store import MemoryStore

ISNAD = "حَدَّثَنَا الْحُمَيْدِيُّ، قَالَ حَدَّثَنَا سُفْيَانُ، عَنْ عُمَرَ بْنِ الْخَطَّابِ، قَالَ سَمِعْتُ رَسُولَ اللَّهِ صلى الله عليه وسلم يَقُولُ "

PASSAGES = [
    Passage(1, "quran", "quran", 112, 1, "سورة:آية", "قُلْ هُوَ اللَّهُ أَحَدٌ"),
    Passage(2, "quran", "quran", 112, 2, "سورة:آية", "اللَّهُ الصَّمَدُ"),
    Passage(3, "quran", "quran", 112, 3, "سورة:آية", "لَمْ يَلِدْ وَلَمْ يُولَدْ"),
    Passage(4, "quran", "quran", 112, 4, "سورة:آية", "وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ"),
    Passage(
        5, "quran", "quran", 49, 13, "سورة:آية",
        "يَا أَيُّهَا النَّاسُ إِنَّا خَلَقْنَاكُمْ مِنْ ذَكَرٍ وَأُنْثَىٰ وَجَعَلْنَاكُمْ شُعُوبًا وَقَبَائِلَ لِتَعَارَفُوا "
        "إِنَّ أَكْرَمَكُمْ عِنْدَ اللَّهِ أَتْقَاكُمْ إِنَّ اللَّهَ عَلِيمٌ خَبِيرٌ",
    ),
    Passage(
        10, "bukhari", "hadith", 1, 1, "arabicnumber",
        ISNAD + "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى",
        text_en="Actions are judged by intentions, and every person will get what they intended.",
    ),
    Passage(
        11, "muslim", "hadith", 2, 223, "arabicnumber",
        "عَنْ أَبِي مَالِكٍ الأَشْعَرِيِّ، قَالَ قَالَ رَسُولُ اللَّهِ صلى الله عليه وسلم الطُّهُورُ شَطْرُ الإِيمَانِ "
        "وَالْحَمْدُ لِلَّهِ تَمْلأُ الْمِيزَانَ",
    ),
    # A hadith that recites a verse (112:1): must not compete with the Quran for a quote presented as Quran.
    Passage(
        13, "abudawud", "hadith", 8, 1461, "arabicnumber",
        "عَنْ أَبِي سَعِيدٍ أَنَّ رَجُلاً سَمِعَ رَجُلاً يَقْرَأُ قُلْ هُوَ اللَّهُ أَحَدٌ يُرَدِّدُهَا",
    ),
    Passage(
        12, "tirmidhi", "hadith", 36, 2317, "arabicnumber",
        "عَنْ أَبِي هُرَيْرَةَ، قَالَ قَالَ رَسُولُ اللَّهِ صلى الله عليه وسلم مِنْ حُسْنِ إِسْلاَمِ الْمَرْءِ تَرْكُهُ مَا لاَ يَعْنِيهِ",
        gradings=[
            {"scholar": "Al-Albani", "grade": "Sahih"},
            {"scholar": "Zubair Ali Zai", "grade": "Daif"},
        ],
    ),
]


@pytest.fixture
def settings() -> Settings:
    return Settings(_env_file=None)


@pytest.fixture
def retriever() -> InMemoryRetriever:
    return InMemoryRetriever(PASSAGES)


@pytest.fixture
def pipeline(settings, retriever) -> Pipeline:
    return Pipeline(settings, retriever, MemoryStore(), llm=None)
