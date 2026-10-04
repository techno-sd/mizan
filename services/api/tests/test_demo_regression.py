"""Regression on real texts: the demo script against the committed fixture corpus (Tanzil + hadith-api)."""

import asyncio
from pathlib import Path

import pytest

from app.config import Settings
from app.pipeline import Pipeline
from app.retrieve import InMemoryRetriever, load_fixture
from app.store import MemoryStore

DEMO = Path(__file__).resolve().parents[3] / "eval" / "demo_script_ar.txt"

EXPECTED = [
    ("خلقناكم", "matches_source", "الحجرات: 13"),
    ("لا اكراه", "reference_mismatch", "البقرة: 256"),  # cited 265
    ("لا ينظر", "reference_mismatch", "صحيح مسلم 2564"),  # cited al-Bukhari
    ("لا يومن", "wording_differs", "صحيح مسلم 45"),  # added «من الخير»; Muslim has an interjection
    ("حسن اسلام", "matches_source", "جامع الترمذي 2317"),
    ("طلب العلم", "matches_source", "سنن ابن ماجه 224"),
    ("النظافه", "not_found", None),
]


@pytest.fixture(scope="module")
def response():
    if not DEMO.exists():
        pytest.skip("demo script not found")
    p = Pipeline(Settings(_env_file=None), InMemoryRetriever(load_fixture()), MemoryStore(), llm=None)
    return asyncio.run(p.verify(DEMO.read_text(encoding="utf-8")))


@pytest.mark.parametrize("fragment,status,ref", EXPECTED)
def test_demo_statuses(response, fragment, status, ref):
    from app.normalize import normalize

    f = next(f for f in response.findings if fragment in normalize(f.quoted_text))
    assert f.status.value == status
    if ref:
        assert ref in (f.suggested_reference or "")


def test_conflicting_and_weak_gradings_surface(response):
    from app.normalize import normalize

    by = {normalize(f.quoted_text): f for f in response.findings}
    assert next(f for k, f in by.items() if "حسن اسلام" in k).needs_scholar_review
    weak = next(f for k, f in by.items() if "طلب العلم" in k)
    assert {g.category for g in weak.gradings} <= {"weak", "rejected"}
