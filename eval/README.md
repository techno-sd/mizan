# eval

| File | Purpose |
|---|---|
| `gold.jsonl` | the gold set built from the corpus: 105 cases, `split` = `dev` (tuning) or `test` (held out) |
| `gold.example.jsonl` | format reference |
| `build_gold.mjs` | regenerates `gold.jsonl` deterministically from a built corpus (`node eval/build_gold.mjs <version>`) |
| `fidelity.jsonl`, `build_fidelity.mjs`, `score_fidelity.mjs` | **word fidelity**: 40 real ayat/hadith, half changed by one word (particle, pronoun, near-synonym, dropped word); objective labels → [results/FIDELITY.md](results/FIDELITY.md) |
| `challenge.jsonl`, `score_challenge.mjs` | **popular claims**: 37 circulating texts (baseless sayings, wrong book, verse errors, controls); labels from the works on weak and fabricated hadith, pending specialist review → [results/CHALLENGE.md](results/CHALLENGE.md) |
| `adversarial.jsonl` | regression cases found after release (Quran alef forms, emoji offsets) |
| `run_eval.py` | runs a live API (or scores saved answers with `--responses`) against a gold-format set; writes `results/` |
| `baselines/` | the same model used directly (`run_baseline.mjs`, with `--gold` and `--grade`) for comparison |
| `results/` | scored runs, comparison, history, saved answers (`responses-*`) and the release check `release-2026-10-06/` |
| `demo_script_ar.txt` | the demo text; also the first example in the web app and `services/api/tests/test_demo_regression.py` |
| `user_test.md`, `user_test_script_ar.txt` | target-user test protocol (still to be run) |
| `specialist_review.md` | what a specialist should review (still to be done) |

```bash
# Live API (needs MIZAN_INTERNAL_API_KEY)
python eval/run_eval.py --api https://mizan-api-dslz.onrender.com --key "$KEY" --gold eval/gold.jsonl --split test --runs 3

# Offline, without the model or the database (from services/api)
MIZAN_LLM_ENABLED=false MIZAN_DATABASE_URL= python -m scripts.eval_offline --version 2026-10-05.2 \
  --gold ../../eval/fidelity.jsonl --split fidelity

# Re-score saved answers
node eval/score_fidelity.mjs && node eval/score_challenge.mjs
```

Gold item fields: `quote` (as written in the text), `type`, `status` (one of the five statuses), `reference`
(expected suggested reference, e.g. `البقرة: 256` or `صحيح مسلم 2564`; `null` if none), `needs_review`.

See [docs/EVALUATION.md](../docs/EVALUATION.md) for metrics, results and their limits.
