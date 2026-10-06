# Baselines

The same model Mizan uses (Claude Sonnet 5.5), used directly as a general assistant: no pipeline, no corpus. Same
cases, same prompt, scored by the same code as Mizan, so the comparison is fair.

```bash
cd eval/baselines && npm install
node run_baseline.mjs --split test --variant plain      # no tools
node run_baseline.mjs --split test --variant search     # with Anthropic's web search tool
node run_baseline.mjs --gold eval/fidelity.jsonl --split fidelity          # another case file
node run_baseline.mjs --gold eval/challenge.jsonl --split all --grade      # also asks for each hadith's grade
```

Answers are written in Mizan's response format to `eval/results/responses-baseline-<variant>-<set>/` and scored with
`python eval/run_eval.py --responses <dir> --tag baseline-<variant>` (or `node eval/score_fidelity.mjs`,
`node eval/score_challenge.mjs`). The prompt is in `run_baseline.mjs`. A refusal is recorded as a failure; there is no
silent fallback to another model. State the date, model, whether search was on, and the limits (small sets, prompt
sensitivity) when reporting. Results: [docs/EVALUATION.md](../../docs/EVALUATION.md).
