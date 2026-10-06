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
| Consistency | items with identical status across 3 runs; report whether cached | 100% |
| Fabricated references | references not present in the corpus | **0 by construction** |
| Latency p50 | per document | < 15 s |

```bash
python eval/run_eval.py --api http://localhost:8000 --key "$MIZAN_INTERNAL_API_KEY" --split dev --runs 3
python eval/run_eval.py ... --split test --runs 3        # once, at the end
```

Results go to `eval/results/<split>-latest.md` (committed) and timestamped JSON (ignored).

Report counts alongside percentages: the historical held-out result is **32/33**, not a general 97% guarantee.
The corpus-derived set favours this retrieval system. Add independently written mutations such as «قال هو الله أحد»
and posts with emojis before quotations; these are regression cases, not additions secretly folded into the original
held-out score. Cached repeats demonstrate repeatability. For independent model stability and uncached latency,
run a separate service with `MIZAN_LLM_CACHE_ENABLED=false`. First-run and later-run latencies are reported separately;
first-run latency alone does not prove a cold cache. Historical results below predate pipeline 0.2.1 and need rerunning
before being presented as measurements of the current build.

Local regression verification for pipeline **0.2.1**, corpus **2026-10-05.2**, rules-only:
- word fidelity: **40/40** detected and correct statuses;
- independently written regression examples (`eval/adversarial.jsonl`): **6/6** detected and correct statuses;
- dev split: **88/92** quotes detected, **88/88** detected quotes had the correct status, no false support among
  scored predictions. Four English Quran excerpts were missed without model extraction. This is not an end-to-end
  100% accuracy claim and is not a replacement for the historical live model comparison.

Reproduce in `services/api` with `MIZAN_LLM_ENABLED=false`:
`python -m scripts.eval_offline --version 2026-10-05.2 --gold ../../eval/fidelity.jsonl --split fidelity`
and the same command with `--gold ../../eval/adversarial.jsonl --split regression`.

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

1. **General model without tools**: `node eval/baselines/run_baseline.mjs --split test --variant plain` (same model as Mizan, Claude Sonnet 5.5; prompt in the script).
2. **General model with web search**: `--variant search` (Anthropic web search tool). This is the fair comparison.

Both write responses in Mizan's format and are scored by the same `run_eval.py --responses ...`.
3. **Manual**: a reviewer with web search; time per script.

Score: wrong or invented references, texts called authentic/present that are not, missed quotes, time. Report the
limits of the comparison (small n, our case selection).

### Two more sets against the same general model (2026-10-05)

The held-out test showed a small accuracy gap, so two sets target what a reviewer of Islam-introduction content
actually faces. Both are scored the same way for Mizan and for the general model.

| Set | What it asks | Mizan | Claude, directly | Details |
|---|---|---|---|---|
| **Popular claims** (`eval/challenge.jsonl`, 37 texts) | baseless/fabricated sayings, authentic hadith cited to the wrong book, verse errors, correct controls | 37/37 correct, 0 invented references, 37/37 identical across 3 runs | 36/37 (missed «وقل **ربي** زدني علما»), 0 invented references | [CHALLENGE.md](../eval/results/CHALLENGE.md) |
| **Word fidelity** (`eval/fidelity.jsonl`, 40 texts) | real ayat and hadith, half changed by one word the way people misquote from memory | **40/40**, 40/40 identical across 3 runs | **31/40**: flagged 7 of 10 *correctly quoted* hadith as "wording differs", missed one dropped word | [FIDELITY.md](../eval/results/FIDELITY.md) |

What this shows: on **famous** baseless sayings a strong current model is already reliable (it knew all 13), so
Mizan's value there is consistency and the evidence it shows, not a large accuracy gap. On **wording**, a model
without the source text cannot confirm a hadith word for word: it either misses small changes or, more often here,
tells the writer to "correct" a hadith that was quoted exactly. Mizan compares against the approved text.

Limits: the fidelity set is generated from Mizan's own corpus (labels are objective because we made each change, but
the texts are ones Mizan holds); the popular-claims labels come from the standard works on weak and fabricated
hadith and are pending specialist review. Small sets: indications, not general claims. Reproduce:
`node eval/build_fidelity.mjs`, `node eval/baselines/run_baseline.mjs --gold eval/fidelity.jsonl --split fidelity`,
`node eval/score_fidelity.mjs` (and `--gold eval/challenge.jsonl --split all --grade`, `node eval/score_challenge.mjs`).

## 5. User test (UX criterion)

- 3–5 people from the target group; one script with 8 planted issues.
- Half check manually first, half with Mizan first (15 minutes each).
- Record: issues found, time, confusing labels.
- Make at least two changes based on the findings and document them (before/after) in `eval/user_test.md`.

## 6. Reporting

The presentation shows: test-split metrics with n, the baseline table with its limits, consistency across runs, and
the list of known failure cases (see [LIMITS.md](LIMITS.md)).
