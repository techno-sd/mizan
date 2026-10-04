from app.normalize import normalize, normalize_with_map

SAMPLES = [
    "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ",
    "قال رسول الله ﷺ: «الطهور شطر الإيمان» (رواه مسلم).",
    "The Prophet (ﷺ) said: \"Actions are by intentions\"",
    "سورة البقرة، آية ٢٥٥",
]


def test_removes_diacritics_and_unifies_letters():
    assert normalize("إِنَّمَا الأَعْمَالُ") == "انما الاعمال"
    assert normalize("مُصْطَفَى") == "مصطفي"
    assert normalize("رحمة") == "رحمه"
    assert normalize("آية ٢٥٥") == "ايه 255"


def test_punctuation_becomes_space():
    assert normalize("«الطهور شطر الإيمان»، (رواه مسلم)") == "الطهور شطر الايمان رواه مسلم"


def test_map_version_matches_plain_version():
    for s in SAMPLES:
        assert normalize_with_map(s)[0] == normalize(s)


def test_map_points_back_to_original():
    text = "قال: «إِنَّمَا الأَعْمَالُ»"
    norm, index = normalize_with_map(text)
    start = norm.find("انما")
    assert text[index[start]] == "إ"
