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
    kind: str  # quran | hadith | source
    aliases: tuple[str, ...]
    # Loaded = its texts are in the corpus (shown as "checked against"). Hadith books are not loaded: they are
    # recognized in what the author cited and in the approved source's takhrij (e.g. «متفق عليه»).
    loaded: bool = False
    scope: str | None = None  # how a loaded source is named in "checked against"


HADEETHENC = "hadeethenc"

COLLECTIONS: dict[str, Collection] = {
    c.key: c
    for c in [
        Collection(
            QURAN, "القرآن الكريم", "The Quran", "quran", ("القران", "quran", "koran"),
            loaded=True, scope="القرآن الكريم: موسوعة القرآن الكريم QuranEnc (نص مصحف المدينة)",
        ),
        Collection(
            HADEETHENC, "موسوعة الأحاديث النبوية", "HadeethEnc", "source", ("موسوعه الاحاديث النبويه", "hadeethenc"),
            loaded=True, scope="الحديث: موسوعة الأحاديث النبوية HadeethEnc (مع التخريج والحكم)",
        ),
        Collection(
            "bukhari", "صحيح البخاري", "Sahih al-Bukhari", "hadith",
            ("البخاري", "صحيح البخاري", "bukhari", "sahih bukhari", "sahih al bukhari"),
        ),
        Collection(
            "muslim", "صحيح مسلم", "Sahih Muslim", "hadith",
            ("صحيح مسلم", "رواه مسلم", "اخرجه مسلم", "sahih muslim"),
        ),
        Collection(
            "abudawud", "سنن أبي داود", "Sunan Abi Dawud", "hadith",
            ("ابو داود", "ابي داود", "ابو داوود", "abu dawud", "abu dawood", "abu daud"),
        ),
        Collection("tirmidhi", "جامع الترمذي", "Jami` at-Tirmidhi", "hadith", ("الترمذي", "tirmidhi", "tirmizi")),
        Collection("nasai", "سنن النسائي", "Sunan an-Nasa'i", "hadith", ("النسايي", "nasai", "nasa i")),
        Collection("ibnmajah", "سنن ابن ماجه", "Sunan Ibn Majah", "hadith", ("ابن ماجه", "ابن ماجة", "ibn majah", "ibn maja")),
        Collection("malik", "موطأ مالك", "Muwatta Malik", "hadith", ("مالك", "الموطا", "موطا مالك", "muwatta")),
        Collection("ahmad", "مسند أحمد", "Musnad Ahmad", "hadith", ("احمد", "مسند احمد", "ahmad")),
        Collection("darimi", "سنن الدارمي", "Sunan ad-Darimi", "hadith", ("الدارمي", "darimi")),
        Collection("ibnhibban", "صحيح ابن حبان", "Sahih Ibn Hibban", "hadith", ("ابن حبان", "ibn hibban")),
        Collection("hakim", "المستدرك للحاكم", "al-Hakim", "hadith", ("الحاكم", "hakim")),
        Collection("bayhaqi", "سنن البيهقي", "al-Bayhaqi", "hadith", ("البيهقي", "bayhaqi")),
        Collection("tabarani", "معجم الطبراني", "at-Tabarani", "hadith", ("الطبراني", "tabarani")),
    ]
}


def loaded_scope() -> list[str]:
    return [c.scope or c.label for c in COLLECTIONS.values() if c.loaded]

# "متفق عليه" = reported by both al-Bukhari and Muslim.
_AGREED = ("متفق عليه", "agreed upon", "muttafaq")


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

    ref.collections = _hadith_collections(norm)
    n = _NUMBER.search(norm)
    if n:
        ref.number = int(n.group(1))
    return ref if not ref.is_empty else None


# Names that are also ordinary words or person names; accepted only in a narration phrase («رواه مسلم وأحمد»).
_NARRATION_NAMES = {"مسلم": "muslim", "مالك": "malik", "احمد": "ahmad", "muslim": "muslim"}
_NARRATION_VERB = re.compile(r"(^| )(رواه|روي|اخرجه|اخرج|اخرجاه|رواها|اخرجها|reported by|narrated by|recorded by)( |$)")


def _hadith_collections(norm: str) -> list[str]:
    """Hadith books named in a normalized reference string, in order of appearance."""
    # «والترمذي» -> «الترمذي»: drop the conjunction so each book matches on its own.
    words = [w[1:] if w.startswith("و") and len(w) > 3 else w for w in norm.split()]
    text = f" {' '.join(words)} "
    found: list[str] = []
    if any(a in norm for a in _AGREED):
        found += ["bukhari", "muslim"]
    for c in COLLECTIONS.values():
        if c.kind == "hadith" and c.key not in found and any(f" {a} " in text for a in c.aliases):
            found.append(c.key)
    # A reference that is just a name («(مسلم)», "(Muslim)") is also accepted.
    if _NARRATION_VERB.search(norm) or found or len(words) <= 2:
        for w in words:
            key = _NARRATION_NAMES.get(w)
            if key and key not in found:
                found.append(key)
    return found


def attribution_collections(attribution: str) -> list[str]:
    """Books named in an approved source's takhrij line, e.g. «رواه أبو داود والترمذي» -> [abudawud, tirmidhi]."""
    return _hadith_collections(normalize(attribution or ""))
