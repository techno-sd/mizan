// Download approved QuranEnc translations into services/api/.cache/sources/quranenc-<key>.json (same shape as the
// English cache used by build_corpus.py). Resumable: finished files are skipped.
//   node scripts/fetch_translations.mjs french_rashid spanish_garcia ...
import fs from "node:fs";
import path from "node:path";

export const TRANSLATIONS = {
  fr: "french_rashid", es: "spanish_garcia", de: "german_bubenheim",
  id: "indonesian_affairs", tr: "turkish_rwwad", ur: "urdu_junagarhi",
};
const cache = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "../.cache/sources");
fs.mkdirSync(cache, { recursive: true });

async function sura(key, s) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(`https://quranenc.com/api/v1/translation/sura/${key}/${s}`, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()).result;
    } catch (e) {
      if (attempt === 4) throw new Error(`${key} sura ${s}: ${e.message}`);
      await new Promise((ok) => setTimeout(ok, 1000 * attempt));
    }
  }
}

const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.values(TRANSLATIONS);
for (const key of keys) {
  const file = path.join(cache, `quranenc-${key}.json`);
  if (fs.existsSync(file)) { console.log(`${key}: cached`); continue; }
  const suras = {};
  const queue = Array.from({ length: 114 }, (_, i) => i + 1);
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) { const s = queue.shift(); suras[s] = await sura(key, s); }
  }));
  fs.writeFileSync(file, JSON.stringify({ key, suras }));
  console.log(`${key}: ${Object.values(suras).reduce((n, a) => n + a.length, 0)} ayat`);
}
