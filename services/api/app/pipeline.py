import asyncio
import hashlib
import time
import uuid

from . import API_VERSION, PIPELINE_VERSION
from .align import Comparison, compare, is_arabic
from .config import Settings
from .extract import ExtractedItem, detect_rules, locate, merge_items
from .llm import PROMPT_VERSION, LLMClient, LLMError
from .normalize import normalize
from .references import COLLECTIONS, QURAN, parse_cited_reference
from .retrieve import Retriever
from .rules import (
    NOT_PROPHETIC,
    acceptable,
    base_status,
    check_reference,
    collect_gradings,
    gradings_conflict,
    is_ambiguous,
    matched_group,
    passage_reference,
    suggested_reference,
    to_evidence,
)
from .schemas import (
    Finding,
    ItemType,
    MatchType,
    ReferenceStatus,
    Summary,
    VerifyResponse,
)
from .store import Store

OUT_OF_SCOPE_NOTE = "هذه النسخة تفحص الآيات والأحاديث والأقوال المنسوبة فقط، ولا تحكم على الادعاءات التاريخية العامة."
NOT_FOUND_NOTE = "لم نجد هذا النص في المصادر المحمّلة. هذا لا يعني بالضرورة أنه موضوع أو غير صحيح."
NO_SAYINGS_CORPUS_NOTE = "لا تتضمن هذه النسخة مدونة لأقوال الصحابة والعلماء خارج كتب الحديث المحمّلة."


class Pipeline:
    def __init__(self, settings: Settings, retriever: Retriever, store: Store, llm: LLMClient | None):
        self.s = settings
        self.retriever = retriever
        self.store = store
        self.llm = llm

    @property
    def corpus_scope(self) -> list[str]:
        return [c.label for c in COLLECTIONS.values()]

    async def verify(self, text: str, debug: bool = False) -> VerifyResponse:
        t0 = time.perf_counter()
        run_id = uuid.uuid4().hex
        trace: list[dict] = []

        rule_items = detect_rules(text)
        llm_items: list[ExtractedItem] = []
        llm_used = False
        if self.llm is not None:
            try:
                for raw in await self.llm.extract_items(text):
                    span = locate(raw["quoted_text"], text)
                    if span is None:
                        trace.append({"dropped_llm_item": raw["quoted_text"][:120], "reason": "not found in input"})
                        continue
                    llm_items.append(
                        ExtractedItem(
                            quoted_text=text[span.start : span.end],
                            type=ItemType(raw["type"]),
                            attributed_to=raw.get("attributed_to") or None,
                            cited_reference=raw.get("cited_reference") or None,
                            span=span,
                            origin="llm",
                        )
                    )
                llm_used = True
            except LLMError as e:
                trace.append({"llm_extract_error": str(e)})

        items = merge_items(llm_items, rule_items)
        sem = asyncio.Semaphore(self.s.llm_concurrency)

        async def run(i: int, item: ExtractedItem) -> Finding:
            async with sem:
                return await self._check(f"f{i + 1}", item, trace if debug else None)

        findings = list(await asyncio.gather(*(run(i, it) for i, it in enumerate(items))))

        by_status: dict[str, int] = {s.value: 0 for s in ReferenceStatus}
        for f in findings:
            by_status[f.status.value] += 1
        summary = Summary(
            total=len(findings),
            by_status=by_status,
            needs_scholar_review=sum(1 for f in findings if f.needs_scholar_review),
        )
        duration_ms = int((time.perf_counter() - t0) * 1000)
        await self.store.record_run(
            {
                "run_id": run_id,
                "corpus_version": self.s.corpus_version,
                "api_version": API_VERSION,
                "pipeline_version": PIPELINE_VERSION,
                "prompt_version": PROMPT_VERSION,
                "llm_model": self.llm.model if self.llm else None,
                "input_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
                "input_chars": len(text),
                "summary": summary.model_dump(),
                "duration_ms": duration_ms,
            }
        )
        return VerifyResponse(
            api_version=API_VERSION,
            pipeline_version=PIPELINE_VERSION,
            run_id=run_id,
            corpus_version=self.s.corpus_version,
            corpus_scope=self.corpus_scope,
            llm_used=llm_used,
            summary=summary,
            findings=findings,
            trace=trace if debug else None,
        )

    async def _check(self, fid: str, item: ExtractedItem, trace: list[dict] | None) -> Finding:
        f = Finding(
            id=fid,
            type=item.type,
            span=item.span,
            quoted_text=item.quoted_text,
            attributed_to=item.attributed_to,
            cited_reference=item.cited_reference,
            status=ReferenceStatus.NOT_FOUND,
        )
        if item.type == ItemType.GENERAL_CLAIM:
            f.status = ReferenceStatus.OUT_OF_SCOPE
            f.notes.append(OUT_OF_SCOPE_NOTE)
            return f

        s = self.s
        translated = not is_arabic(item.quoted_text)
        if translated and item.type == ItemType.QURAN:
            return await self._check_translated_verse(f, item, trace)
        candidates = await self.retriever.search(item.quoted_text, None, s.retrieve_k)
        # Word-for-word matches first, then by similarity.
        comparisons = sorted(
            (compare(item.quoted_text, c.passage, s.t_exact, s.t_variant) for c in candidates),
            key=lambda c: (c.match_type not in (MatchType.EXACT, MatchType.PARTIAL), -c.similarity),
        )
        # A verse presented as Quran is judged against the Quran when it matches there: a hadith that recites
        # the verse is not a competing source (and must not make the result "ambiguous"). The reverse case stays
        # unfiltered, so a verse presented as a hadith is still reported.
        if item.type == ItemType.QURAN:
            quran_hits = [c for c in comparisons if c.passage.collection == QURAN and c.match_type is not None]
            if quran_hits:
                comparisons = [c for c in comparisons if c.passage.collection == QURAN]
        group = matched_group(comparisons, s.t_variant, s.ambiguity_margin)
        step: dict = {
            "finding": fid,
            "origin": item.origin,
            "candidates": [
                {"id": c.passage.id, "ref": passage_reference(c.passage), "similarity": round(c.similarity, 1)}
                for c in comparisons[:5]
            ],
        }

        if not group and comparisons and self.llm is not None:
            group = await self._adjudicate(item, comparisons[:5], f, step)

        if is_ambiguous(comparisons, s.t_variant, s.ambiguity_margin):
            f.needs_scholar_review = True
            f.review_reasons.append("أكثر من نص متقارب في المصادر؛ يحتاج تحديد المقصود.")

        f.status = base_status(group, s.t_exact)
        cited = parse_cited_reference(item.cited_reference)
        matches = acceptable(comparisons, s.t_variant) or group
        mismatch, ref_notes, _ = check_reference(cited, group, matches)
        f.notes.extend(ref_notes)
        # Narrations in a cited collection that the best-match group missed still count as evidence.
        if cited and not mismatch:
            group += [c for c in matches if c not in group and c.passage.collection in cited.collections]
            # Judge the wording against the source the author cited: if the exact words are only in another
            # collection, and the cited one has a different wording, the quote's wording differs from its source.
            hadith_cited = [k for k in cited.collections if k != QURAN]
            in_cited = [c for c in group if c.passage.collection in hadith_cited]
            exact = (MatchType.EXACT, MatchType.PARTIAL)
            if in_cited and not any(c.match_type in exact for c in in_cited) and f.status == ReferenceStatus.MATCHES_SOURCE:
                elsewhere = [c for c in group if c.match_type in exact]
                group = in_cited + [c for c in group if c not in in_cited]
                f.status = ReferenceStatus.WORDING_DIFFERS
                labels = "، ".join(COLLECTIONS[k].label for k in hadith_cited if k in COLLECTIONS)
                refs = "، ".join(dict.fromkeys(passage_reference(c.passage) for c in elsewhere))
                f.notes.append(f"بهذا اللفظ في: {refs}؛ أما لفظه في {labels} فمختلف (انظر الفرق).")

        found_collections = {c.passage.collection for c in group}
        if group and cited is None:
            if item.type == ItemType.QURAN and QURAN not in found_collections:
                mismatch = True
                f.notes.append("قُدِّم النص على أنه آية، لكنه وُجد في كتب الحديث وليس في القرآن.")
            elif item.type == ItemType.HADITH and found_collections == {QURAN}:
                mismatch = True
                f.notes.append("قُدِّم النص على أنه حديث، لكنه آية قرآنية.")
        if translated and group:
            # Translations of the same hadith differ from book to book, so the cited collection can't be judged
            # from English wording: report where it was found and leave the reference to a reviewer.
            if mismatch:
                mismatch = False
                f.notes = [n for n in f.notes if n not in ref_notes]
                f.needs_scholar_review = True
                f.review_reasons.append(
                    "النص مترجم، وتختلف صياغة الترجمات بين الكتب؛ لذلك لم نحكم على الإحالة آليًا. انظر مواضع وروده أدناه."
                )
            f.notes.append("المقارنة مع ترجمة إنجليزية واحدة من مصدر البيانات؛ قد تختلف صياغة ترجمتك دون أن يختلف المعنى.")
        if mismatch:
            f.status = ReferenceStatus.REFERENCE_MISMATCH

        if group:
            f.evidence = [to_evidence(c) for c in group[:5]]
            await self._add_quran_context(f)
            f.diff = group[0].diff
            f.suggested_reference = suggested_reference(group)
            f.gradings = collect_gradings([c.passage for c in group])
            if gradings_conflict(f.gradings):
                f.needs_scholar_review = True
                f.review_reasons.append("أحكام العلماء المنقولة على هذا الحديث متباينة.")
            if item.type == ItemType.HADITH and any(
                k in g.grade.lower() for g in f.gradings for k in NOT_PROPHETIC
            ):
                f.notes.append("بعض الأحكام تصف النص بأنه موقوف أو مقطوع، أي من قول صحابي أو تابعي لا من قول النبي ﷺ.")
            if len(normalize(item.quoted_text).split()) < 3:
                f.needs_scholar_review = True
                f.review_reasons.append("النص قصير جدًا للمطابقة الموثوقة.")
        else:
            if item.type == ItemType.ATTRIBUTED_QUOTE:
                f.status = ReferenceStatus.OUT_OF_SCOPE
                f.notes.append(NO_SAYINGS_CORPUS_NOTE)
            else:
                f.notes.append(NOT_FOUND_NOTE)
            if comparisons and comparisons[0].similarity >= 40:
                nearest = to_evidence(comparisons[0])
                nearest.match_type = MatchType.SEMANTIC
                f.nearest = nearest

        step.update({"status": f.status.value, "review": f.review_reasons, "notes": f.notes})
        if trace is not None:
            trace.append(step)
        return f

    async def _adjudicate(
        self, item: ExtractedItem, top: list[Comparison], f: Finding, step: dict
    ) -> list[Comparison]:
        """Ask Claude only when deterministic matching found nothing; verify its answer before using it."""
        lang_ar = is_arabic(item.quoted_text)
        payload = [
            {
                "id": c.passage.id,
                "reference": passage_reference(c.passage),
                "text": c.passage.text_ar if lang_ar or not c.passage.text_en else f"{c.passage.text_ar}\n{c.passage.text_en}",
            }
            for c in top
        ]
        try:
            verdict = await self.llm.adjudicate(item.quoted_text, payload)
        except LLMError as e:
            step["llm_adjudicate_error"] = str(e)
            return []
        step["llm_adjudicate"] = verdict
        if verdict["decision"] == "different" or verdict["passage_id"] == 0:
            return []
        chosen = next((c for c in top if c.passage.id == verdict["passage_id"]), None)
        excerpt = normalize(verdict.get("supporting_excerpt", ""))
        haystack = f"{chosen.passage.text_ar_norm} {chosen.passage.text_en_norm}" if chosen else ""
        if chosen is None or not excerpt or excerpt not in haystack:
            f.needs_scholar_review = True
            f.review_reasons.append("لم نتمكن من التحقق آليًا من المطابقة المقترحة.")
            return []
        chosen.match_type = MatchType.SEMANTIC
        f.notes.append("المطابقة هنا بالمعنى أو عبر الترجمة، حددها النموذج وتحققنا من وجود المقطع في المصدر. راجع النص الأصلي.")
        # same_text (e.g. a faithful translation) counts as a match; same_meaning as differing wording.
        chosen.similarity = max(chosen.similarity, self.s.t_exact if verdict["decision"] == "same_text" else self.s.t_variant)
        return [chosen]

    async def _check_translated_verse(self, f: Finding, item: ExtractedItem, trace: list[dict] | None) -> Finding:
        """A verse quoted in translation. No Quran translations are loaded, so compare against the Arabic ayah at
        the cited reference: Claude judges whether the translation renders it, and must cite an excerpt that is
        verified to exist in the Arabic text. Without Claude, the ayah is shown for comparison only."""
        step: dict = {"finding": f.id, "origin": item.origin, "translated_quran": True}
        cited = parse_cited_reference(item.cited_reference)
        ayat = []
        if cited and cited.surah and cited.ayah:
            ayat = await self.retriever.lookup(QURAN, number=cited.ayah, book=cited.surah)
        if not ayat:
            f.status = ReferenceStatus.OUT_OF_SCOPE
            f.notes.append(
                "لا تتضمن هذه النسخة ترجمات لمعاني القرآن، ولم تُذكر إحالة (سورة:آية) يمكن المقارنة بها؛ تحقق من الآية بنصها العربي."
            )
            if trace is not None:
                trace.append(step)
            return f

        ayah = ayat[0]
        comp = Comparison(ayah, 0.0, 1.0, "ar", None)
        verdict = None
        if self.llm is not None:
            try:
                verdict = await self.llm.adjudicate(
                    item.quoted_text, [{"id": ayah.id, "reference": passage_reference(ayah), "text": ayah.text_ar}]
                )
                step["llm_adjudicate"] = verdict
            except LLMError as e:
                step["llm_adjudicate_error"] = str(e)
        excerpt = normalize((verdict or {}).get("supporting_excerpt", ""))
        verified = bool(verdict) and verdict["passage_id"] == ayah.id and excerpt and excerpt in ayah.text_ar_norm

        if verified and verdict["decision"] in ("same_text", "same_meaning"):
            comp.match_type = MatchType.SEMANTIC
            f.status = (
                ReferenceStatus.MATCHES_SOURCE if verdict["decision"] == "same_text" else ReferenceStatus.WORDING_DIFFERS
            )
            f.notes.append(
                "النص ترجمة؛ حكم النموذج بأنها تؤدي معنى الآية في الموضع المذكور، وتحققنا من وجود المقطع المستشهد به في نصها العربي. راجع الآية."
            )
        else:
            f.status = ReferenceStatus.OUT_OF_SCOPE
            if verified and verdict["decision"] == "different":
                f.needs_scholar_review = True
                f.review_reasons.append("لا يبدو أن الترجمة تؤدي معنى الآية في الموضع المذكور؛ راجع الإحالة.")
            f.notes.append("لا تتضمن هذه النسخة ترجمات لمعاني القرآن. الآية في الموضع المذكور معروضة للمقارنة.")
        f.evidence = [to_evidence(comp)]
        await self._add_quran_context(f)
        f.suggested_reference = passage_reference(ayah)
        if trace is not None:
            trace.append(step)
        return f

    async def _add_quran_context(self, f: Finding) -> None:
        """Show the previous and next ayah so a verse is never read out of context."""
        ev = f.evidence[0]
        if ev.collection != QURAN:
            return
        ev.context_before, ev.context_after = await self.retriever.neighbors(ev.passage_id)
