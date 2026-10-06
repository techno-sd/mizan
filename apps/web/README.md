# Mizan web app

Next.js (App Router) + TypeScript + Tailwind. Arabic-first, right-to-left UI. Deployed on Vercel (project root
`apps/web`).

```bash
cp .env.example .env.local   # MIZAN_API_URL and MIZAN_INTERNAL_API_KEY (same value as the API)
npm install
npm run dev                  # http://localhost:3000
npm test                     # unit tests (tests/*.test.ts, Node test runner)
npm run lint && npm run build
```

## Where things are

| Path | What it does |
|---|---|
| `src/app/api/verify`, `image-text`, `feedback` | server-side proxies to the Mizan API: add the internal key, apply a per-IP rate limit. The browser never calls the API directly. |
| `src/components/Verifier.tsx` | home page (chat box, examples) and the review screen (tabs, grouped reply, source list) |
| `src/components/FindingResponse.tsx` | one quote in the reply: verdict, what differs, the fix, rulings, expandable source details |
| `src/components/CorrectedCopy.tsx`, `CorrectionDecision.tsx` | suggested corrected text with per-change include/keep decisions |
| `src/components/ReviewReportButton.tsx`, `src/lib/review-report.ts` | downloadable HTML review report |
| `src/components/Feedback.tsx` | "is this result right?" report button |
| `src/lib/review-text.ts` | all reply wording, built deterministically from the API response (no model text) |
| `src/lib/corrected.ts` | the corrected copy, from source passages and matched spans only |
| `src/lib/image.ts` | shrinks a screenshot in the browser before upload |
| `src/lib/types.ts` | mirror of `services/api/app/schemas.py`: keep them in sync |
| `src/lib/sample.ts` | example texts; the first one must stay identical to `eval/demo_script_ar.txt` (regression test) |

Add `?debug` to the page URL to see the pipeline trace under the results.
