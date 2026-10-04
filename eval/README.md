# eval

| File | Purpose |
|---|---|
| `gold.example.jsonl` | format reference (5 real cases). Copy to `gold.jsonl` and grow to ~100 items |
| `gold.jsonl` | the gold set (`split`: `dev` for tuning, `test` held out until the end); 100 cases / 120 items |
| `build_gold.mjs` | regenerates `gold.jsonl` deterministically from the built corpus (`node eval/build_gold.mjs 2026-10-04`) |
| `run_eval.py` | runs a live API against the gold set N times; writes `results/<split>-latest.md` |
| `demo_script_ar.txt` | the demo text; also used by `services/api/tests/test_demo_regression.py` |
| `baselines/` | protocol and scoring sheet for the general-model baselines |
| `user_test.md` | user-test notes and the changes made from them (create during Day 2) |

```bash
# API running locally on :8000
python eval/run_eval.py --gold eval/gold.jsonl --split dev --runs 3
```

Gold item fields: `quote` (as written in the text), `type`, `status` (one of the five statuses), `reference`
(expected suggested reference, e.g. `البقرة: 256` or `صحيح مسلم 2564`; `null` if none), `needs_review`.

See [docs/EVALUATION.md](../docs/EVALUATION.md) for the plan, metrics and targets.
