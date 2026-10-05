"""Readers' reports on results: validated, and stored without the checked text."""

import asyncio

import pytest
from pydantic import ValidationError

from app.schemas import FeedbackRequest
from app.store import MemoryStore


def test_feedback_is_validated():
    fb = FeedbackRequest(run_id="r1", finding_id="f2", verdict="wrong", status="matches_source",
                         quoted_text="الدين النصيحة", comment="الإحالة الصحيحة رواه مسلم")
    assert fb.verdict == "wrong"
    with pytest.raises(ValidationError):
        FeedbackRequest(run_id="r1", finding_id="f2", verdict="maybe")
    with pytest.raises(ValidationError):
        FeedbackRequest(run_id="r1", finding_id="f2", verdict="wrong", comment="x" * 1001)


def test_feedback_is_stored_with_its_versions_only():
    store = MemoryStore()
    fb = FeedbackRequest(run_id="r1", finding_id="f1", verdict="correct").model_dump(mode="json")
    asyncio.run(store.record_feedback(fb | {"corpus_version": "2026-10-05.2", "pipeline_version": "0.1.0"}))
    assert store.feedback == [fb | {"corpus_version": "2026-10-05.2", "pipeline_version": "0.1.0"}]
    assert "text" not in store.feedback[0]
