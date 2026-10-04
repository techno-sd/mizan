# Evaluation

Mizan's claims are measured, not asserted. This plan maps directly to the final judging criteria (baseline
comparison, repeatability, behaviour on conflicts and missing information, user testing, stated limits).

## 1. Gold set (`eval/gold.jsonl`)

Format: [`eval/gold.example.jsonl`](../eval/gold.example.jsonl). One case per line, with `split` = `dev` or `test`.
**The test split is not looked at while tuning thresholds or prompts.**

`node eval/build_gold.mjs 2026-10-04` generates the set deterministically from the built corpus (100 cases, 120
items, 70/30 split stratified by category). Labels come from the corpus itself: excerpts are checked to be unique
in the whole corpus; "wrong collection" cases are kept only if the cited collection holds no close wording; "not in
corpus" sayings are kept only if absent. The content specialist reviews the not-found list, the altered wordings
and the English items (some English excerpts quote a Companion rather than the Prophet ﷺ) before the final run.

To evaluate without a database or HTTP: `python -m scripts.eval_offline --split dev` (in `services/api`). It loads
the full corpus into `IndexedRetriever`, runs the pipeline in-process, and writes
`eval/results/<split>-offline-<rules|llm>.md` with per-category accuracy and every failure.

Target composition (~100 items, 70 dev / 30 test):

| Category | Items | Gold label source |
|---|---|---|
| Hadith quoted exactly (excerpt or full) | 15 | collection + number |
| Hadith with changed, added or merged wording | 15 | record + `wording_differs` |
| Authentic text, wrong collection or number | 10 | correct reference |
| Circulating weak/very weak texts present in the corpus | 10 | gradings from the data |
| Sayings not in the corpus presented as hadith | 10 | `not_found` |
| Quran verses, correct | 10 | surah:ayah |
| Quran verses with wrong ayah/surah or altered wording | 10 | correct surah:ayah |
| Hadith presented as Quran, or the reverse | 5 | `reference_mismatch` |
| English quotes of hadith translations | 10 | record |
| Full realistic scripts (several items each) | 5 | all items (detection recall) |

Most labels are objective (does the text exist, where), so the team can build them from the sources. The content
specialist reviews a random sample and every `needs_review` label.

## 2. Metrics (`eval/run_eval.py`)

| Metric | Definition | Target |
|---|---|---|
| **False support rate** (north star) | share of `matches_source` predictions whose gold status differs | ≤ 2% |
| Detection recall | expected items found at all | ≥ 90% |
| Status accuracy | matched items with the gold status | ≥ 85% |
| Abstention recall | gold `not_found` items not matched to a source | ≥ 95% |
| Reference accuracy | gold reference contained in the suggested reference | ≥ 90% |
| Review recall | gold `needs_review` items flagged | ≥ 80% |
| Consistency | items with identical status across 3 runs | 100% |
| Fabricated references | references not present in the corpus | **0 by construction** |
| Latency p50 | per document | < 15 s |

```bash
python eval/run_eval.py --api http://localhost:8000 --key "$MIZAN_INTERNAL_API_KEY" --split dev --runs 3
python eval/run_eval.py ... --split test --runs 3        # once, at the end
```

Results go to `eval/results/<split>-latest.md` (committed) and timestamped JSON (ignored).

## 3. Ablations (show that each part adds value)

| Run | Change |
|---|---|
| A | rules only (`MIZAN_LLM_ENABLED=false`) |
| B | full pipeline |
| C | B without window refinement / grouping (shows the false mismatches they prevent) |
| D | B with embeddings, if added |

Report detection recall (A vs B shows what Claude extraction adds) and false support rate (should not rise).

## 4. Baselines

Same test cases, same scoring by hand for free-text answers (sheet: `eval/baselines/scoring_template.csv`):

1. **General model without tools**: prompt in [`eval/baselines/README.md`](../eval/baselines/README.md).
2. **General model with web search**: the same prompt. This is the fair comparison.
3. **Manual**: a reviewer with web search; time per script.

Score: wrong or invented references, texts called authentic/present that are not, missed quotes, time. Report the
limits of the comparison (small n, our case selection).

## 5. User test (UX criterion)

- 3–5 people from the target group; one script with 8 planted issues.
- Half check manually first, half with Mizan first (15 minutes each).
- Record: issues found, time, confusing labels.
- Make at least two changes based on the findings and document them (before/after) in `eval/user_test.md`.

## 6. Reporting

The presentation shows: test-split metrics with n, the baseline table with its limits, consistency across runs, and
the list of known failure cases (see [LIMITS.md](LIMITS.md)).
