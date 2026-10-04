"""Arabic/English text normalization for matching.

Normalized text is only used for search and comparison. Displayed text always comes from the
original (user text or verbatim source text).
"""

import re

# Harakat, Quranic annotation marks, superscript alef, tatweel.
_DIACRITICS = re.compile("[ؐ-ًؚ-ٰٟۖ-ۭـ]")
_CHAR_MAP = str.maketrans(
    {
        "أ": "ا",
        "إ": "ا",
        "آ": "ا",
        "ٱ": "ا",
        "ى": "ي",
        "ة": "ه",
        "ؤ": "و",
        "ئ": "ي",
        **{chr(0x0660 + i): str(i) for i in range(10)},  # Arabic-Indic digits
        **{chr(0x06F0 + i): str(i) for i in range(10)},  # Extended Arabic-Indic digits
    }
)
# Anything that is not a letter or digit becomes a space (punctuation, brackets, quotes, ﷺ, …).
_NON_WORD = re.compile(r"[^\w]+", re.UNICODE)
_SPACES = re.compile(r"\s+")


def normalize_char(ch: str) -> str:
    """Normalize one character. Returns '' when the character is dropped."""
    if _DIACRITICS.match(ch):
        return ""
    ch = ch.translate(_CHAR_MAP).lower()
    if _NON_WORD.fullmatch(ch) or ch == "_":
        return " "
    return ch


def normalize(text: str) -> str:
    text = _DIACRITICS.sub("", text).translate(_CHAR_MAP).lower()
    text = _NON_WORD.sub(" ", text).replace("_", " ")
    return _SPACES.sub(" ", text).strip()


def normalize_with_map(text: str) -> tuple[str, list[int]]:
    """Normalize and return, for each normalized character, its index in the original text.

    Lets us find a quote in normalized space and highlight it in the original text.
    """
    out: list[str] = []
    index: list[int] = []
    prev_space = True
    for i, ch in enumerate(text):
        n = normalize_char(ch)
        if not n:
            continue
        if n == " ":
            if prev_space:
                continue
            prev_space = True
        else:
            prev_space = False
        for c in n:  # lower() can expand one character into several
            out.append(c)
            index.append(i)
    if out and out[-1] == " ":
        out.pop()
        index.pop()
    return "".join(out), index


def tokens(text: str) -> list[str]:
    return normalize(text).split()
