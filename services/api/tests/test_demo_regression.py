"""Regression on real texts: the demo script against the committed fixture corpus.

The fixture holds the approved sources (QuranEnc, HadeethEnc) and a few texts from the supplementary source
(hadith-api), which every result must name as such.
"""

import asyncio
from pathlib import Path

import pytest

from app.config import Settings
from app.normalize import normalize
from app.pipeline import Pipeline
from app.retrieve import InMemoryRetriever, load_fixture
from app.store import MemoryStore

DEMO = Path(__file__).resolve().parents[3] / "eval" / "demo_script_ar.txt"

EXPECTED = [
    # (fragment of the quote, status, fragment of the suggested reference)
    ("خلقناكم", "matches_source", "الحجرات: 13"),  # standard spelling vs Uthmani mushaf text
    ("لا اكراه", "reference_mismatch", "البقرة: 256"),  # cited 265
    ("لا ينظر", "reference_mismatch", "رواه مسلم"),  # cited al-Bukhari; HadeethEnc takhrij: رواه مسلم
    ("لا يومن", "wording_differs", "متفق عليه"),  # «من الخير» is not in the approved text
    ("حسن اسلام", "matches_source", "رواه الترمذي"),
    ("طلب العلم", "matches_source", "سنن ابن ماجه"),  # only in the supplementary source, with weak gradings
    ("النظافه", "not_found", None),
]


@pytest.fixture(scope="module")
def response():
    if not DEMO.exists():
        pytest.skip("demo script not found")
    p = Pipeline(Settings(_env_file=None), InMemoryRetriever(load_fixture()), MemoryStore(), llm=None)
    return asyncio.run(p.verify(DEMO.read_text(encoding="utf-8")))


def find(response, fragment):
    return next(f for f in response.findings if normalize(fragment) in normalize(f.quoted_text))


@pytest.mark.parametrize("fragment,status,ref", EXPECTED)
def test_demo_statuses(response, fragment, status, ref):
    f = find(response, fragment)
    assert f.status.value == status
    if ref:
        assert ref in (f.suggested_reference or "")


def test_every_evidence_and_ruling_names_its_source(response):
    for f in response.findings:
        for e in f.evidence:
            assert e.source_label
            if e.collection == "hadeethenc":
                assert e.source_approved and e.takhrij
            elif e.collection != "quran":
                assert not e.source_approved and "hadith-api" in e.source_label
        for g in f.gradings:
            assert g.source_label


@pytest.mark.parametrize("fragment,takhrij", [("لا ينظر", "رواه مسلم"), ("لا يومن", "متفق عليه")])
def test_approved_source_comes_first(response, fragment, takhrij):
    f = find(response, fragment)  # in HadeethEnc and in hadith-api
    assert f.evidence[0].source_approved
    assert f.suggested_reference.startswith(takhrij)


def test_supplementary_grades_are_shown_in_arabic():
    from app.rules import collect_gradings
    from app.retrieve import Passage

    p = Passage(id=1, collection="ibnmajah", kind="hadith", book=None, number=224, numbering_scheme=None,
                text_ar="", gradings=[{"scholar": "Al-Albani", "grade": "Very Daif"}, {"scholar": "x", "grade": "Sanad Daif"},
                          {"scholar": "y", "grade": "-"}],
                extra={"source_id": "hadith-api"})
    g = collect_gradings([p])
    assert [(x.scholar_ar, x.grade_ar) for x in g] == [("الألباني", "ضعيف جدًا"), (None, "إسناده ضعيف")]


def test_supplementary_only_text_is_labelled(response):
    f = find(response, "طلب العلم")
    assert f.evidence and not f.evidence[0].source_approved
    assert {g.category for g in f.gradings} <= {"weak", "rejected"}
    assert all(not g.source_approved for g in f.gradings)


def test_not_found_never_says_fabricated(response):
    f = find(response, "النظافه")
    assert not f.evidence and not f.gradings
    assert any("لا يعني" in n for n in f.notes)
