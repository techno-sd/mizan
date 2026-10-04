"""Deterministic comparison of a quote with a source passage: similarity, match type and word diff."""

import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher

from rapidfuzz import fuzz

from .normalize import normalize
from .retrieve import Passage
from .schemas import DiffOp, MatchType

_ARABIC = re.compile(r"[؀-ۿ]")


@dataclass
class _Word:
    orig: str
    norm: str
    idx: int  # index of the original whitespace token


@dataclass
class Comparison:
    passage: Passage
    similarity: float  # 0-100, quote vs the aligned window of the passage
    coverage: float  # share of the passage covered by the window (1.0 = whole passage)
    lang: str  # ar | en
    match_type: MatchType | None
    diff: list[DiffOp] = field(default_factory=list)
    window_norm: str = ""  # the normalized part of the passage that aligned with the quote
    highlight: tuple[int, int] | None = None  # char span of that part in the displayed source text


def is_arabic(text: str) -> bool:
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return False
    return sum(1 for c in letters if _ARABIC.match(c)) / len(letters) >= 0.5


def _words(text: str) -> list[_Word]:
    out: list[_Word] = []
    for idx, tok in enumerate(text.split()):
        for sub in normalize(tok).split():
            out.append(_Word(tok, sub, idx))
    return out


def _window(quote_norm: str, words: list[_Word]) -> tuple[int, int]:
    """Word range [a, b) of the passage that best aligns with the quote."""
    joined = " ".join(w.norm for w in words)
    starts, pos = [], 0
    for w in words:
        starts.append(pos)
        pos += len(w.norm) + 1
    al = fuzz.partial_ratio_alignment(quote_norm, joined)
    if al is None:
        return 0, len(words)
    if len(quote_norm) > len(joined):  # quote longer than passage: the whole passage is the window
        return 0, len(words)
    a = next((i for i, s in enumerate(starts) if s + len(words[i].norm) > al.dest_start), 0)
    b = next((i for i, s in enumerate(starts) if s >= al.dest_end), len(words))
    return a, max(b, a + 1)


def _refine(quote_norm: str, words: list[_Word], a: int, b: int) -> tuple[int, int]:
    """Move the window edges a few words either way to maximise similarity. The character-level
    alignment has the quote's length, so it cuts off text when the source has an interjection
    (e.g. «لأخيه - أو قال لجاره - ما يحب لنفسه»)."""
    best = (fuzz.ratio(quote_norm, " ".join(w.norm for w in words[a:b])), a, b)
    for da in range(-3, 3):
        for db in range(-2, 6):
            na, nb = max(0, a + da), min(len(words), b + db)
            if nb <= na:
                continue
            score = fuzz.ratio(quote_norm, " ".join(w.norm for w in words[na:nb]))
            if score > best[0]:
                best = (score, na, nb)
    return best[1], best[2]


def _append(ops: list[DiffOp], op: str, words: list[_Word]) -> None:
    if not words:
        return
    # Several normalized sub-words can come from one original token; show the token once.
    toks: list[str] = []
    last = None
    for w in words:
        if w.idx != last:
            toks.append(w.orig)
            last = w.idx
    text = " ".join(toks)
    if ops and ops[-1].op == op:
        ops[-1].text += " " + text
    else:
        ops.append(DiffOp(op=op, text=text))


def word_diff(quote: list[_Word], source: list[_Word]) -> list[DiffOp]:
    """insert = words only in the user's quote; delete = words only in the source."""
    sm = SequenceMatcher(None, [w.norm for w in quote], [w.norm for w in source], autojunk=False)
    ops: list[DiffOp] = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            _append(ops, "equal", source[j1:j2])
        elif tag == "delete":
            _append(ops, "insert", quote[i1:i2])
        elif tag == "insert":
            _append(ops, "delete", source[j1:j2])
        else:
            _append(ops, "delete", source[j1:j2])
            _append(ops, "insert", quote[i1:i2])
    return ops


def compare(quote: str, passage: Passage, t_exact: float, t_variant: float) -> Comparison:
    lang = "ar" if is_arabic(quote) or not passage.text_en else "en"
    source_text = passage.text_ar if lang == "ar" else (passage.text_en or "")
    q_words = _words(quote)
    s_words = _words(source_text)
    if not q_words or not s_words:
        return Comparison(passage, 0.0, 0.0, lang, None)

    q_norm = " ".join(w.norm for w in q_words)
    a, b = _refine(q_norm, s_words, *_window(q_norm, s_words))
    window = s_words[a:b]
    window_norm = " ".join(w.norm for w in window)
    similarity = fuzz.ratio(q_norm, window_norm)
    coverage = len(window) / len(s_words)

    if similarity >= t_exact:
        match_type = MatchType.EXACT if coverage >= 0.9 else MatchType.PARTIAL
    elif similarity >= t_variant:
        match_type = MatchType.VARIANT
    else:
        match_type = None

    diff = word_diff(q_words, window) if match_type else []
    tokens = list(re.finditer(r"\S+", source_text))
    highlight = (tokens[window[0].idx].start(), tokens[window[-1].idx].end()) if window else None
    return Comparison(passage, float(similarity), coverage, lang, match_type, diff, window_norm, highlight)


def same_matn(a: Comparison, b: Comparison, threshold: float = 85.0) -> bool:
    """Both passages carry the same wording where the quote aligned (e.g. one hadith via two chains,
    or in both Sahihs). Compares the aligned windows, not whole passages, so different isnads don't matter."""
    return fuzz.ratio(a.window_norm, b.window_norm) >= threshold
