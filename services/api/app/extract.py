"""Finding the quotes in the user's text.

Two sources feed the same structure:
  * rule-based detection of explicit markers (﴿﴾, قال تعالى, قال رسول الله ﷺ, "The Prophet ﷺ said")
  * Claude extraction (see llm.py) for everything the markers miss.
Every item must be locatable in the original text; anything that is not is dropped, so the model can
never introduce a quote the author did not write.
"""

import re
from dataclasses import dataclass, field

from rapidfuzz import fuzz

from .normalize import normalize_with_map
from .references import parse_cited_reference
from .schemas import ItemType, Span


@dataclass
class ExtractedItem:
    quoted_text: str
    type: ItemType
    attributed_to: str | None = None
    cited_reference: str | None = None
    span: Span | None = None
    origin: str = "rules"  # rules | llm | merged
    notes: list[str] = field(default_factory=list)


_SAW = r"\s*(?:\(?\s*(?:ﷺ|صلى الله عليه وسلم|عليه الصلاة والسلام|عليه السلام)\s*\)?)?"
_EN_SAW = r"\s*(?:\((?:ﷺ|pbuh|saw|s\.a\.w\.?|peace be upon him)\)|ﷺ)?"

QURAN_MARKERS = re.compile(
    r"(?:قال|يقول|وقال|قول(?:ه)?)\s+(?:الله\s+)?(?:تعالى|عز وجل|سبحانه(?:\s+وتعالى)?)\s*[:：]?\s*"
)
HADITH_MARKERS = re.compile(
    r"(?:(?:قال|وقال|يقول|عن|أن|ان)\s+(?:رسول\s+الله|النبي|الرسول)" + _SAW + r"(?:\s+(?:قال|أنه قال|انه قال))?"
    r"|قوله" + _SAW + r")\s*[:：]?\s*"
)
EN_HADITH_MARKERS = re.compile(
    r"(?:the\s+)?(?:prophet(?:\s+muhammad)?|messenger\s+of\s+allah)" + _EN_SAW + r"\s+(?:said|says)\s*[:,]?\s*",
    re.IGNORECASE,
)
QURAN_BRACKETS = re.compile(r"﴿([^﴾]{2,2000})﴾")

_OPEN_CLOSE = {"«": "»", '"': '"', "“": "”", "'": "'", "﴿": "﴾", "„": "“"}
_SENTENCE_END = re.compile(r"[.!؟?\n]")


def _capture_quote(text: str, start: int) -> tuple[int, int] | None:
    """Capture the quote that starts at `start`: a bracketed/quoted string or the rest of the sentence."""
    if start >= len(text):
        return None
    opener = text[start]
    if opener in _OPEN_CLOSE:
        close = text.find(_OPEN_CLOSE[opener], start + 1)
        if close != -1 and close - start <= 2000:
            return start + 1, close
    m = _SENTENCE_END.search(text, start)
    end = m.start() if m else len(text)
    end = min(end, start + 600)
    return (start, end) if end - start >= 4 else None


def _cited_reference_after(text: str, end: int) -> str | None:
    """Look right after a quote for a reference such as "(رواه البخاري)" or "[البقرة: 255]"."""
    tail = text[end : end + 160].split("\n")[0]
    tail = tail.lstrip(" \t»”\"'﴾:،,")
    if not tail:
        return None
    if tail[0] in "([":
        close = tail.find(")" if tail[0] == "(" else "]")
        segment = tail[1:close] if close != -1 else tail[1:]
    else:
        segment = re.split(r"[.؛;]", tail, maxsplit=1)[0]
    segment = segment.strip()
    return segment if parse_cited_reference(segment) else None


def detect_rules(text: str) -> list[ExtractedItem]:
    items: list[ExtractedItem] = []

    for m in QURAN_BRACKETS.finditer(text):
        items.append(
            ExtractedItem(
                quoted_text=m.group(1).strip(),
                type=ItemType.QURAN,
                attributed_to="الله تعالى",
                cited_reference=_cited_reference_after(text, m.end()),
                span=Span(start=m.start(1), end=m.end(1)),
            )
        )

    for pattern, item_type, who in (
        (QURAN_MARKERS, ItemType.QURAN, "الله تعالى"),
        (HADITH_MARKERS, ItemType.HADITH, "النبي ﷺ"),
        (EN_HADITH_MARKERS, ItemType.HADITH, "The Prophet ﷺ"),
    ):
        for m in pattern.finditer(text):
            cap = _capture_quote(text, m.end())
            if not cap:
                continue
            s, e = cap
            quoted = text[s:e].strip()
            if not quoted:
                continue
            items.append(
                ExtractedItem(
                    quoted_text=quoted,
                    type=item_type,
                    attributed_to=who,
                    cited_reference=_cited_reference_after(text, e + 1 if e < len(text) else e),
                    span=Span(start=s, end=e),
                )
            )
    return merge_items(items, [])


def locate(quoted: str, text: str, min_score: float = 90.0) -> Span | None:
    """Find `quoted` in `text`: exact, then normalized, then fuzzy. Returns a span in the original text."""
    quoted = quoted.strip()
    if not quoted:
        return None
    i = text.find(quoted)
    if i != -1:
        return Span(start=i, end=i + len(quoted))

    norm_text, index = normalize_with_map(text)
    norm_quote, _ = normalize_with_map(quoted)
    if not norm_quote or not norm_text:
        return None
    j = norm_text.find(norm_quote)
    if j != -1:
        return Span(start=index[j], end=index[j + len(norm_quote) - 1] + 1)

    al = fuzz.partial_ratio_alignment(norm_quote, norm_text)
    if al is not None and al.score >= min_score and al.dest_end > al.dest_start:
        return Span(start=index[al.dest_start], end=index[al.dest_end - 1] + 1)
    return None


def _overlap(a: Span, b: Span) -> float:
    inter = max(0, min(a.end, b.end) - max(a.start, b.start))
    shorter = min(a.end - a.start, b.end - b.start) or 1
    return inter / shorter


def merge_items(llm_items: list[ExtractedItem], rule_items: list[ExtractedItem]) -> list[ExtractedItem]:
    """Union of both sources, de-duplicated by span overlap. LLM fields win; rules fill gaps."""
    merged: list[ExtractedItem] = []
    for item in [*llm_items, *rule_items]:
        if item.span is None:
            continue
        twin = next((m for m in merged if m.span and _overlap(m.span, item.span) > 0.5), None)
        if twin is None:
            merged.append(item)
            continue
        twin.cited_reference = twin.cited_reference or item.cited_reference
        twin.attributed_to = twin.attributed_to or item.attributed_to
        if twin.origin != item.origin:
            twin.origin = "merged"
    return sorted(merged, key=lambda it: it.span.start if it.span else 0)
