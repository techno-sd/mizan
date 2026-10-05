"""Turning comparisons into a status. Every status is defined by an observable test, not by a score feeling.

matches_source      best similarity >= t_exact and the cited reference (if any) agrees
wording_differs     t_variant <= best similarity < t_exact
reference_mismatch  the text was found, but not where the author said (other book, surah/ayah, or
                    found as hadith while presented as Quran, and vice versa)
not_found           nothing >= t_variant in the loaded corpus. Never means "fabricated".
out_of_scope        claim types this version does not check
"""

from .align import Comparison, same_matn
from .references import COLLECTIONS, HADEETHENC, QURAN, CitedRef, quran_reference
from .retrieve import Passage
from .schemas import Evidence, Grading, MatchType, ReferenceStatus, Span

# Category is a display hint only; the UI always shows the scholar's own wording.
# Order matters: "very daif" must be checked before "daif", "daif" before "sahih" ("shadh, sahih").
_REJECTED = ("موضوع", "باطل", "منكر", "ضعيف جدا", "لا اصل له", "mawdu", "maudu", "fabricated", "munkar",
             "batil", "very daif", "very weak", "daif jiddan")
_WEAK = ("ضعيف", "شاذ", "مرسل", "معلول", "daif", "da'if", "weak", "shadh", "mursal", "malool")
_ACCEPTED = ("صحيح", "حسن", "sahih", "hasan")
# The narration is a Companion's (mauquf) or a later narrator's (maqtu) saying, not the Prophet's.
NOT_PROPHETIC = ("mauquf", "muquf", "maqtu", "موقوف", "مقطوع")


SCHOLARS_AR = {
    "al-albani": "الألباني",
    "shuaib al arnaut": "شعيب الأرنؤوط",
    "zubair ali zai": "زبير علي زئي",
    "ahmad muhammad shakir": "أحمد محمد شاكر",
    "bashar awad maarouf": "بشار عواد معروف",
    "muhammad fouad abd al-baqi": "محمد فؤاد عبد الباقي",
    "muhammad muhyi al-din abdul hamid": "محمد محيي الدين عبد الحميد",
    "abu ghuddah": "عبد الفتاح أبو غدة",
    "salim al-hilali": "سليم الهلالي",
}
_GRADE_TERMS_AR = [  # longest first
    ("very daif", "ضعيف جدًا"), ("sahih lighairihi", "صحيح لغيره"), ("hasan lighairihi", "حسن لغيره"),
    ("hasan sahih", "حسن صحيح"), ("agreed upon", "متفق عليه"), ("sahih", "صحيح"), ("hasan", "حسن"),
    ("daif", "ضعيف"), ("mawdu", "موضوع"), ("munkar", "منكر"), ("shadh", "شاذ"), ("batil", "باطل"),
    ("mauquf", "موقوف"), ("muquf", "موقوف"), ("maqtu", "مقطوع"), ("mursal", "مرسل"), ("isnaad", "الإسناد"),
    ("bukhari", "البخاري"), ("muslim", "مسلم"), ("and", "و"),
]


def grade_ar(grade: str) -> str | None:
    g = grade.lower()
    if any("؀" <= ch <= "ۿ" for ch in g):
        return grade
    out = g
    for en, ar in _GRADE_TERMS_AR:
        out = out.replace(en, ar)
    return out if out != g and not any("a" <= ch <= "z" for ch in out) else None


def grade_category(grade: str) -> str:
    g = grade.lower()
    if any(k in g for k in _REJECTED):
        return "rejected"
    if any(k in g for k in _WEAK):
        return "weak"
    if any(k in g for k in _ACCEPTED):
        return "accepted"
    return "unknown"


def passage_reference(p: Passage) -> str:
    if p.collection == QURAN and p.book and p.number:
        return quran_reference(p.book, p.number)
    if p.collection == HADEETHENC:
        # The approved takhrij is the reference a writer should cite; the encyclopedia number makes it traceable.
        attribution = (p.extra.get("attribution") or "").strip()
        where = f"موسوعة الأحاديث النبوية، رقم {p.number}"
        return f"{attribution} ({where})" if attribution else where
    label = COLLECTIONS[p.collection].label if p.collection in COLLECTIONS else p.collection
    return f"{label} {p.number}" if p.number is not None else label


def to_evidence(c: Comparison) -> Evidence:
    p = c.passage
    col = COLLECTIONS.get(p.collection)
    return Evidence(
        passage_id=p.id,
        collection=p.collection,
        collection_label=col.label if col else p.collection,
        reference=passage_reference(p),
        number=p.number,
        numbering_scheme=p.numbering_scheme,
        text=p.text_ar,
        text_en=p.text_en,
        url=p.url,
        similarity=round(c.similarity, 1),
        match_type=c.match_type or MatchType.SEMANTIC,
        highlight=Span(start=c.highlight[0], end=c.highlight[1]) if c.highlight and c.match_type else None,
        highlight_lang=c.lang if c.highlight and c.match_type else None,
        takhrij=p.extra.get("takhrij") or None,
    )


def collect_gradings(passages: list[Passage]) -> list[Grading]:
    seen: set[tuple[str, str]] = set()
    out: list[Grading] = []
    for p in passages:
        for g in p.gradings:
            scholar, grade = (g.get("scholar") or g.get("name") or "").strip(), (g.get("grade") or "").strip()
            if not grade or (scholar, grade) in seen:
                continue
            seen.add((scholar, grade))
            out.append(
                Grading(
                    scholar=scholar,
                    grade=grade,
                    scholar_ar=SCHOLARS_AR.get(scholar.lower()),
                    grade_ar=grade_ar(grade),
                    category=grade_category(grade),
                )
            )
    return out


def gradings_conflict(gradings: list[Grading]) -> bool:
    cats = {g.category for g in gradings}
    return "accepted" in cats and bool(cats & {"weak", "rejected"})


def acceptable(comparisons: list[Comparison], t_variant: float) -> list[Comparison]:
    return [c for c in comparisons if c.match_type is not None and c.similarity >= t_variant]


def matched_group(comparisons: list[Comparison], t_variant: float, margin: float) -> list[Comparison]:
    """The best match plus other passages carrying the same wording (e.g. the hadith in both Sahihs)."""
    ok = acceptable(comparisons, t_variant)
    if not ok:
        return []
    best = ok[0]
    return [c for c in ok if c is best or same_matn(c, best)]


def is_ambiguous(comparisons: list[Comparison], t_variant: float, margin: float) -> bool:
    """Two passages with different wording match the quote about equally well."""
    ok = acceptable(comparisons, t_variant)
    if len(ok) < 2:
        return False
    best = ok[0]
    return any(c.similarity >= best.similarity - margin and not same_matn(c, best) for c in ok[1:])


def check_reference(
    cited: CitedRef | None, group: list[Comparison], matches: list[Comparison] | None = None
) -> tuple[bool, list[str], bool]:
    """Returns (mismatch, notes, numbering_only). A number-only difference is a soft note, not a mismatch.

    `matches` = every acceptable match (any narration of the text). A cited collection counts as
    confirmed if any of them is in it, even when that narration's wording differs slightly.
    """
    if cited is None or not group:
        return False, [], False
    passages = [c.passage for c in (matches or group)]
    notes: list[str] = []

    if QURAN in cited.collections:
        quran = [p for p in passages if p.collection == QURAN]
        if not quran:
            return True, ["قُدِّم النص على أنه آية، لكنه وُجد في كتب الحديث وليس في القرآن."], False
        if cited.surah and all(p.book != cited.surah for p in quran):
            return True, ["رقم السورة أو اسمها المذكور لا يطابق موضع النص."], False
        # Surah and ayah must match as a pair (a similar verse can sit at that number in another surah).
        if cited.ayah and not any(
            p.number == cited.ayah and (cited.surah is None or p.book == cited.surah) for p in quran
        ):
            return True, ["رقم الآية المذكور لا يطابق موضع النص."], False
        return False, notes, False

    if cited.collections:
        # Books the text is reported in: the collection itself, or the approved takhrij (HadeethEnc).
        found = {s for p in passages for s in p.sources}
        missing = [c for c in cited.collections if c not in found]
        if QURAN in found and not (found - {QURAN}):
            return True, ["النص آية قرآنية وليس حديثًا."], False
        if missing:
            labels = "، ".join(COLLECTIONS[c].label for c in missing if c in COLLECTIONS)
            attributions = [p.extra.get("attribution") for p in passages if p.extra.get("attribution")]
            if attributions:
                given = "؛ ".join(dict.fromkeys(attributions))
                return True, [f"تخريج المصدر المعتمد لا يذكر {labels}؛ المذكور فيه: «{given}»."], False
            return True, [f"لم نجد هذا النص في: {labels} ضمن المصادر المعتمدة."], False
        if cited.number:
            in_cited = [p for p in passages if p.collection in cited.collections]
            if in_cited and all(p.number != cited.number for p in in_cited):
                scheme = in_cited[0].numbering_scheme or "الترقيم المستخدم"
                return False, [f"رقم الحديث المذكور يختلف عن رقمه في المصادر المحمّلة ({scheme}). قد يختلف الترقيم بين الطبعات."], True
    return False, notes, False


def base_status(group: list[Comparison], t_exact: float) -> ReferenceStatus:
    """Word-for-word identical → matches; otherwise wording differs. A model-assisted (semantic) match
    counts as matching only when the model judged it the same text (similarity raised to t_exact)."""
    if not group:
        return ReferenceStatus.NOT_FOUND
    best = group[0]
    if best.match_type in (MatchType.EXACT, MatchType.PARTIAL):
        return ReferenceStatus.MATCHES_SOURCE
    if best.match_type == MatchType.SEMANTIC and best.similarity >= t_exact:
        return ReferenceStatus.MATCHES_SOURCE
    return ReferenceStatus.WORDING_DIFFERS


def suggested_reference(group: list[Comparison]) -> str | None:
    refs: list[str] = []
    for c in group:
        r = passage_reference(c.passage)
        if r not in refs:
            refs.append(r)
    return "؛ ".join(refs[:4]) if refs else None
