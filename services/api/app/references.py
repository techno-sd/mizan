"""Collections registry and parsing of references the author cited ("رواه البخاري 1", "[البقرة: 255]")."""

import json
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from .normalize import normalize

QURAN = "quran"


@dataclass(frozen=True)
class Collection:
    key: str
    label: str
    label_en: str
    kind: str  # quran | hadith
    aliases: tuple[str, ...]
    # Present in the two Sahih collections: reported as such, without a separate grading.
    is_sahihayn: bool = False


COLLECTIONS: dict[str, Collection] = {
    c.key: c
    for c in [
        Collection(QURAN, "القرآن الكريم", "The Quran", "quran", ("القران", "quran", "koran")),
        Collection(
            "bukhari", "صحيح البخاري", "Sahih al-Bukhari", "hadith",
            ("البخاري", "صحيح البخاري", "bukhari", "sahih bukhari", "sahih al bukhari"),
            is_sahihayn=True,
        ),
        Collection(
            "muslim", "صحيح مسلم", "Sahih Muslim", "hadith",
            ("صحيح مسلم", "رواه مسلم", "اخرجه مسلم", "sahih muslim"),
            is_sahihayn=True,
        ),
        Collection(
            "abudawud", "سنن أبي داود", "Sunan Abi Dawud", "hadith",
            ("ابو داود", "ابي داود", "ابو داوود", "abu dawud", "abu dawood", "abu daud"),
        ),
        Collection(
            "tirmidhi", "جامع الترمذي", "Jami` at-Tirmidhi", "hadith",
            ("الترمذي", "tirmidhi", "tirmizi"),
        ),
        Collection("nasai", "سنن النسائي", "Sunan an-Nasa'i", "hadith", ("النسايي", "nasai", "nasa i")),
        Collection(
            "ibnmajah", "سنن ابن ماجه", "Sunan Ibn Majah", "hadith",
            ("ابن ماجه", "ابن ماجة", "ibn majah", "ibn maja"),
        ),
        Collection("malik", "موطأ مالك", "Muwatta Malik", "hadith", ("الموطا", "موطا مالك", "muwatta")),
        Collection("nawawi", "الأربعون النووية", "40 Hadith Nawawi", "hadith", ("الاربعين النوويه", "الاربعون النوويه", "nawawi")),
        Collection("qudsi", "الأحاديث القدسية", "40 Hadith Qudsi", "hadith", ("حديث قدسي", "قدسي", "qudsi")),
    ]
}

# "متفق عليه" = reported by both al-Bukhari and Muslim.
_AGREED = ("متفق عليه", "agreed upon", "muttafaq")
# Bare "مسلم"/"muslim" is too ambiguous on its own; only accept it after a narration verb.
_NARRATED_BY_MUSLIM = re.compile(r"(رواه|اخرجه|في|reported by|narrated by|in)\s+(الامام\s+)?(مسلم|muslim)\b")


@dataclass
class CitedRef:
    raw: str
    collections: list[str] = field(default_factory=list)
    number: int | None = None
    surah: int | None = None
    ayah: int | None = None

    @property
    def is_empty(self) -> bool:
        return not (self.collections or self.number or self.surah)


@dataclass(frozen=True)
class Surah:
    number: int
    ayas: int
    name: str
    tname: str
    ename: str


@lru_cache
def surahs() -> list[Surah]:
    path = Path(__file__).parent / "data" / "surahs.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    return [Surah(s["number"], s["ayas"], s["name"], s["tname"], s["ename"]) for s in data["surahs"]]


def surah_label(number: int) -> str:
    return surahs()[number - 1].name


def quran_reference(surah: int, ayah: int) -> str:
    return f"{surah_label(surah)}: {ayah}"


def _strip_al(s: str) -> str:
    return re.sub(r"^(al|an|ar|as|ash|at|az|ad|adh|ath)\s+", "", s)


@lru_cache
def _surah_name_index() -> list[tuple[str, int]]:
    """(normalized name, number), longest names first so 'ال عمران' wins over shorter matches."""
    pairs: list[tuple[str, int]] = []
    for s in surahs():
        pairs.append((normalize(s.name), s.number))
        pairs.append((_strip_al(normalize(s.tname)), s.number))
    return sorted(pairs, key=lambda p: -len(p[0]))


_PAIR = re.compile(r"\b(\d{1,3})\s*[:/]\s*(\d{1,3})\b")
_NUMBER = re.compile(r"\b(\d{1,5})\b")


def parse_cited_reference(raw: str | None) -> CitedRef | None:
    if not raw or not raw.strip():
        return None
    ref = CitedRef(raw=raw.strip())
    # Keep ':' and '/' for "2:255"; normalize() would drop them.
    lowered = raw.lower()
    norm = normalize(raw)

    m = _PAIR.search(lowered.translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")))
    if m and 1 <= int(m.group(1)) <= 114:
        ref.surah, ref.ayah = int(m.group(1)), int(m.group(2))
        ref.collections = [QURAN]
        return ref

    padded = f" {norm} "
    mentions_surah = any(w in norm for w in ("سوره", "قران", "surah", "sura", "quran"))
    for name, number in _surah_name_index():
        if f" {name} " not in padded:
            continue
        followed_by_number = re.search(rf"(^| ){re.escape(name)} \d", norm)
        # Short names (طه، يس، ص، ق) only count when followed by an ayah number, e.g. "[طه: 65]".
        if (len(name) < 3 and followed_by_number) or (len(name) >= 3 and (mentions_surah or followed_by_number)):
            ref.surah = number
            ref.collections = [QURAN]
            after = norm.split(name, 1)[1]
            n = _NUMBER.search(after)
            if n:
                ref.ayah = int(n.group(1))
            return ref

    if any(a in norm for a in _AGREED):
        ref.collections = ["bukhari", "muslim"]
    else:
        for c in COLLECTIONS.values():
            if c.key == QURAN:
                continue
            if any(f" {a} " in padded for a in c.aliases):
                ref.collections.append(c.key)
        if _NARRATED_BY_MUSLIM.search(norm) and "muslim" not in ref.collections:
            ref.collections.append("muslim")

    n = _NUMBER.search(norm)
    if n:
        ref.number = int(n.group(1))
    return ref if not ref.is_empty else None
