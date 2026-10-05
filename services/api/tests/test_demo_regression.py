"""Regression on real texts: the demo script against the committed fixture corpus.

The fixture is built from the approved sources only (QuranEnc for the Quran, HadeethEnc for hadith).
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
    ("طلب العلم", "not_found", None),  # not in the approved sources
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


def test_every_hadith_shown_has_an_approved_source_and_ruling(response):
    # «لا ينسب حديث دون مصدر وحكم معتمد في البيانات»
    for f in response.findings:
        for e in f.evidence:
            if e.collection != "quran":
                assert e.collection == "hadeethenc"
                assert e.takhrij
                assert f.gradings and all(g.scholar == "موسوعة الأحاديث النبوية" for g in f.gradings)


def test_not_found_never_says_fabricated(response):
    f = find(response, "طلب العلم")
    assert not f.evidence and not f.gradings
    assert any("لا يعني" in n for n in f.notes)
