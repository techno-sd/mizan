from app.references import parse_cited_reference


def test_quran_bracket_reference():
    r = parse_cited_reference("البقرة: 255")
    assert r.collections == ["quran"] and r.surah == 2 and r.ayah == 255


def test_quran_numeric_pair():
    r = parse_cited_reference("Quran 49:13")
    assert (r.surah, r.ayah) == (49, 13)


def test_surah_word_with_name():
    r = parse_cited_reference("سورة الإخلاص")
    assert r.surah == 112 and r.ayah is None


def test_hadith_collection_and_number():
    r = parse_cited_reference("رواه مسلم (223)")
    assert r.collections == ["muslim"] and r.number == 223


def test_agreed_upon_means_both_sahihs():
    r = parse_cited_reference("متفق عليه")
    assert r.collections == ["bukhari", "muslim"]


def test_english_reference():
    r = parse_cited_reference("Sahih al-Bukhari 1")
    assert r.collections == ["bukhari"] and r.number == 1


def test_no_reference():
    assert parse_cited_reference("") is None
    assert parse_cited_reference("وهذا مهم جدا") is None
