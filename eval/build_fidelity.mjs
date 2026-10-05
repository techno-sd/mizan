// Build eval/fidelity.jsonl: does a checker notice a small change in a verse or hadith? Deterministic (seeded).
//   node eval/build_fidelity.mjs [corpus_version]
// Real ayat (QuranEnc) and hadith excerpts (HadeethEnc, cited with their approved takhrij), half of them changed
// the way people misquote from memory: a particle or pronoun swapped (من/عن، في/على، لكم/لهم), one word dropped,
// or two neighbouring words swapped. Every changed text is checked to occur nowhere in the corpus, so the right
// answer is objective: unchanged → matches_source, changed → wording_differs. Same format as eval/gold.jsonl.
import fs from "node:fs";
import readline from "node:readline";

const version = process.argv[2] || "2026-10-05.2";
const CORPUS = new URL(`../services/api/data/corpus/${version}/passages.jsonl`, import.meta.url);
const SURAHS = JSON.parse(fs.readFileSync(new URL("../services/api/app/data/surahs.json", import.meta.url), "utf8")).surahs;
const OUT = new URL("./fidelity.jsonl", import.meta.url);

let seed = 20261006;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const shuffle = (arr) => arr.map((v) => [rand(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

const DIAC = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const MAP = { "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ة": "ه", "ؤ": "و", "ئ": "ي" };
const norm = (s) => (s || "").replace(DIAC, "").replace(/[أإآٱىةؤئ]/g, (c) => MAP[c]).toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
const plain = (s) => s.replace(DIAC, "").replace(/[‎‏]/g, "").replace(/\s+/g, " ").trim();
const words = (s) => plain(s).replace(/[.,،:؛!؟?]+/g, " ").split(/\s+/).filter((w) => /\p{L}/u.test(w));

const passages = [];
const rl = readline.createInterface({ input: fs.createReadStream(CORPUS, "utf8"), crlfDelay: Infinity });
for await (const line of rl) if (line.trim()) passages.push(JSON.parse(line));
const allNorm = passages.map((p) => p.text_ar_norm);
const count = (n) => allNorm.reduce((c, t) => c + (t.includes(n) ? 1 : 0), 0);

// Realistic memory errors only (matched on the normalized word): a particle or pronoun swapped, a near-synonym,
// or a small function word dropped. No reordering or dropped content words: nobody misquotes that way.
const SWAP = { "من": "عن", "عن": "من", "في": "على", "علي": "في", "الي": "على", "لكم": "لهم", "لهم": "لكم",
  "عليكم": "عليهم", "عليهم": "عليكم", "يحب": "يرضى", "الناس": "العباد", "قال": "يقول", "جعل": "خلق",
  "عظيم": "كبير", "خير": "أفضل", "الدنيا": "الحياة", "يوم": "في يوم" };
const DROP = new Set(["قد", "لقد", "ان", "ثم", "هو", "هم", "كل", "الا"]);
function alter(ws) {
  const inner = [...ws.keys()].slice(1, -1);
  for (const op of shuffle(["swap", "drop"])) {
    if (op === "swap") {
      const i = shuffle(inner).find((k) => SWAP[norm(ws[k])]);
      if (i !== undefined) { const out = [...ws]; out[i] = SWAP[norm(ws[i])]; return [out, `«${ws[i]}» ← «${out[i]}»`]; }
    }
    if (op === "drop") {
      const i = shuffle(inner).find((k) => DROP.has(norm(ws[k])));
      if (i !== undefined) return [ws.filter((_, k) => k !== i), `حذف «${ws[i]}»`];
    }
  }
  return null;
}

const items = [];
const add = (category, text, quote, status, reference, type, notes) =>
  items.push({ category, text, expected: [{ quote, type, status, reference, needs_review: false }], notes });

// Quran: whole ayat of 7-16 words that occur once in the corpus.
const ayat = shuffle(passages.filter((p) => p.kind === "quran" && count(p.text_ar_norm) === 1)
  .filter((p) => { const n = p.text_ar_norm.split(" ").length; return n >= 7 && n <= 16; }));
const qref = (p) => `${SURAHS[p.book - 1].name}: ${p.number}`;
let qe = 0, qa = 0;
for (const p of ayat) {
  const ws = words(p.text_ar);
  if (qe < 10) { add("quran_exact", `قال تعالى: ﴿${ws.join(" ")}﴾ [${qref(p)}].`, ws.join(" "), "matches_source", qref(p), "quran", ""); qe++; continue; }
  if (qa >= 10) break;
  const r = alter(ws);
  if (!r || count(norm(r[0].join(" "))) > 0) continue;
  add("quran_altered", `قال تعالى: ﴿${r[0].join(" ")}﴾ [${qref(p)}].`, r[0].join(" "), "wording_differs", qref(p), "quran", `${r[1]}؛ الأصل: ${ws.join(" ")}`);
  qa++;
}

// Hadith: 8-12 word excerpts of the Prophet's words in HadeethEnc, unique in the corpus, cited with the takhrij.
const takhrij = (p) => (p.extra?.attribution || "").split(/\n/)[0].trim().replace(/[.،]+$/, "");
const hadith = shuffle(passages.filter((p) => p.collection === "hadeethenc" && /^(رواه|متفق عليه)/.test(takhrij(p)) && takhrij(p).length <= 50));
const href = (p) => `${p.extra.attribution} (موسوعة الأحاديث النبوية، رقم ${p.number})`;
let he = 0, ha = 0;
for (const p of hadith) {
  if (he >= 10 && ha >= 10) break;
  const quoted = [...p.text_ar.matchAll(/«([^»]+)»/g)].map((m) => m[1]).sort((a, b) => b.length - a.length)[0];
  if (!quoted) continue;
  const all = words(quoted);
  if (all.length < 8) continue;
  const ws = all.slice(0, 8 + Math.floor(rand() * 5));
  if (count(norm(ws.join(" "))) !== 1 || /رسول الله|صلي الله|النبي/.test(norm(ws.join(" ")))) continue;
  const cite = takhrij(p);
  if (he < 10) { add("hadith_exact", `قال رسول الله ﷺ: «${ws.join(" ")}» (${cite}).`, ws.join(" "), "matches_source", href(p), "hadith", ""); he++; continue; }
  const r = alter(ws);
  if (!r || count(norm(r[0].join(" "))) > 0) continue;
  add("hadith_altered", `قال رسول الله ﷺ: «${r[0].join(" ")}» (${cite}).`, r[0].join(" "), "wording_differs", href(p), "hadith", `${r[1]}؛ الأصل: ${ws.join(" ")}`);
  ha++;
}

const lines = items.map((it, i) => JSON.stringify({ id: `f-${String(i + 1).padStart(2, "0")}`, split: "fidelity", ...it, origin: "auto", corpus: version }));
fs.writeFileSync(OUT, lines.join("\n") + "\n");
console.log(Object.entries(items.reduce((m, x) => ({ ...m, [x.category]: (m[x.category] || 0) + 1 }), {})));
