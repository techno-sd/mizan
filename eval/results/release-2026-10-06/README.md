# Release verification: 2026-10-06

Local verification of pipeline 0.2.1, corpus 2026-10-05.2 (45,792 passages), and the new reviewer workflow.

| Check | Observed result | Scope |
|---|---|---|
| Independently written regression examples | 6/6 detected; correct statuses and references; no false support in this set | Six previously identified regressions, not an independent human benchmark |
| Word fidelity | 40/40 detected; correct statuses and references; no false support in this set | Corpus-derived set; labels follow its deliberately introduced wording changes |
| Reviewer workflow | Text-first suggested copy; eligible changes included by default, optional include/exclude controls, restore-all, switch views and download report | Browser interaction using a local rules-only fixture API |
| Frontend tests | Selective approval, pending/kept/blocked cases, Unicode offsets, overlap handling, report escaping and metadata | Automated technical checks; not user or specialist testing |

Both backend runs used `MIZAN_LLM_ENABLED=false` and `MIZAN_LLM_CACHE_ENABLED=false`. They do not measure model
extraction recall, independent model stability, live-service latency, or a comparison with a general model.
Timing includes retrieval and rule processing after corpus indexing, not network or startup costs. The source sets
were not expanded or retuned for this run; percentages must not be presented as general accuracy guarantees.

Detailed outputs: [regression](regression-offline-rules.md), [word fidelity](fidelity-offline-rules.md).

The downloadable HTML report is an offline snapshot containing source evidence, reported gradings, reviewer
decisions, unresolved notices, run ID, and corpus/pipeline versions. The reader can print it or save a PDF through
the browser. It is not a signed certificate or a completed scholarly review. Eligible changes are included in the suggested draft by default, with no claim of human approval;
ambiguous, semantic, overlapping, or cross-type findings remain unchanged even when suggestions are included.

## Still requires real evidence

- Target-user observations and timing: [user test](../../user_test.md).
- Specialist review of difficult cases and result labels: [specialist review](../../specialist_review.md).
- An uncached full-model run on independently authored examples, including detection failures, with a reviewed
  answer key and a baseline comparison.
- Final deployment verification, video, and presentation; local checks do not establish these are complete.
