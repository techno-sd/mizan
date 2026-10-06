"""Public API contract. The web app, the eval runner and future integrations all depend on this."""

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class ItemType(StrEnum):
    QURAN = "quran"
    HADITH = "hadith"
    ATTRIBUTED_QUOTE = "attributed_quote"  # a saying attributed to a person (not the Prophet)
    GENERAL_CLAIM = "general_claim"  # historical/factual claim; out of scope in v0.1


class ReferenceStatus(StrEnum):
    """Text axis: does the quoted text and its cited reference match the loaded corpus?"""

    MATCHES_SOURCE = "matches_source"
    WORDING_DIFFERS = "wording_differs"
    REFERENCE_MISMATCH = "reference_mismatch"
    NOT_FOUND = "not_found"
    OUT_OF_SCOPE = "out_of_scope"


class MatchType(StrEnum):
    EXACT = "exact"
    VARIANT = "variant"
    PARTIAL = "partial"
    SEMANTIC = "semantic"


class Span(BaseModel):
    """Half-open Unicode code-point offsets, not UTF-16 code units."""
    start: int
    end: int


class Grading(BaseModel):
    """A ruling reported by a named scholar. Mizan reports gradings; it never computes one."""

    scholar: str  # as written in the source data
    grade: str  # as written in the source data
    scholar_ar: str | None = None
    grade_ar: str | None = None
    # Where this ruling was taken from, e.g. "موسوعة الأحاديث النبوية (HadeethEnc)" or "مجموعة hadith-api".
    source_label: str | None = None
    source_approved: bool = True
    category: str = Field(description="accepted | weak | rejected | unknown (display hint only)")


class DiffOp(BaseModel):
    op: str = Field(description="equal | insert | delete (insert = only in the user's text)")
    text: str


class Evidence(BaseModel):
    passage_id: int
    collection: str
    collection_label: str
    reference: str  # human readable, e.g. "صحيح البخاري 1" or "البقرة: 255"
    number: int | None = None
    numbering_scheme: str | None = None
    text: str
    text_en: str | None = None
    url: str | None = None
    similarity: float
    match_type: MatchType
    # Surrounding text (previous/next ayah) so a quote is never judged out of context.
    context_before: str | None = None
    context_after: str | None = None
    # The part of `text` (or `text_en` when highlight_lang == "en") that matched the quote.
    highlight: Span | None = None
    highlight_lang: str | None = None
    # Full takhrij from the approved source (HadeethEnc), so every hadith is traceable to its books.
    takhrij: str | None = None
    # Where this text comes from. approved = listed in the challenge's scientific reference package.
    source_id: str = ""
    source_label: str = ""
    source_url: str = ""
    source_approved: bool = True


class Finding(BaseModel):
    id: str
    type: ItemType
    span: Span | None
    quoted_text: str
    attributed_to: str | None = None
    cited_reference: str | None = None
    status: ReferenceStatus
    needs_scholar_review: bool = False
    review_reasons: list[str] = []
    evidence: list[Evidence] = []
    # Closest text when nothing matched. It is a DIFFERENT text, shown so the user can judge; never a correction.
    nearest: Evidence | None = None
    gradings: list[Grading] = []
    diff: list[DiffOp] = []
    suggested_reference: str | None = None
    notes: list[str] = []


class Summary(BaseModel):
    total: int
    by_status: dict[str, int]
    needs_scholar_review: int


class VerifyRequest(BaseModel):
    text: str = Field(min_length=1)
    debug: bool = False


IMAGE_MAX_BYTES = 4_500_000  # the browser shrinks screenshots well below this


class ImageTextRequest(BaseModel):
    """A screenshot to transcribe before checking. Base64 without the data: prefix."""

    media_type: Literal["image/jpeg", "image/png", "image/webp", "image/gif"]
    data: str = Field(min_length=16, max_length=IMAGE_MAX_BYTES * 4 // 3 + 4)


class ImageTextResponse(BaseModel):
    text: str


class FeedbackRequest(BaseModel):
    """A reader's report on one result, queued for a specialist to review. Holds only the quote, not the text."""

    run_id: str = Field(min_length=1, max_length=64)
    finding_id: str = Field(min_length=1, max_length=16)
    verdict: Literal["correct", "wrong"]
    status: ReferenceStatus | None = None
    quoted_text: str = Field(default="", max_length=600)
    suggested_reference: str | None = Field(default=None, max_length=300)
    comment: str = Field(default="", max_length=1000)


class VerifyResponse(BaseModel):
    api_version: str
    pipeline_version: str
    run_id: str
    corpus_version: str
    corpus_scope: list[str]
    llm_used: bool
    summary: Summary
    findings: list[Finding]
    trace: list[dict] | None = None
