# Mizan web app

Next.js (App Router) + TypeScript + Tailwind. Arabic-first, right-to-left UI.

```bash
cp .env.example .env.local   # set MIZAN_API_URL and MIZAN_INTERNAL_API_KEY
npm install
npm run dev                  # http://localhost:3000
```

- `src/app/api/verify/route.ts` forwards requests to the Mizan API from the server, adds the internal key and
  applies a simple per-IP rate limit. The browser never calls the API directly.
- `src/lib/types.ts` mirrors `services/api/app/schemas.py`. Keep them in sync.
- Add `?debug` to the page URL to see the pipeline trace under the results.

Deploy on Vercel with the project root set to `apps/web`.
