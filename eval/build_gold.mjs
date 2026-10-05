// Build eval/gold.jsonl from the built corpus (approved sources: QuranEnc + HadeethEnc). Deterministic (seeded).
//   node eval/build_gold.mjs [corpus_version]
// Labels are derived from the corpus itself (does the text exist, where, with which approved takhrij), so they
// are objective. The content specialist reviews the not-found list and the altered wordings.
import fs from "node:fs";
import readline from "node:readline";

const version = process.argv[2] || "2026-10-05";
const CORPUS = new URL(`../services/api/data/corpus/${version}/passages.jsonl`, import.meta.url);
const SURAHS = JSON.parse(fs.readFileSync(new URL("../services/api/app/data/surahs.json", import.meta.url), "utf8")).surahs;
const OUT = new URL("./gold.jsonl", import.meta.url);

// --- deterministic RNG -------------------------------------------------------
let seed = 20261005;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const shuffle = (arr) => arr.map((v) => [rand(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

// --- normalization (port of services/api/app/normalize.py) --------------------
const DIAC = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const MAP = { "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ة": "ه", "ؤ": "و", "ئ": "ي" };
const norm = (s) => (s || "").replace(DIAC, "").replace(/[أإآٱىةؤئ]/g, (c) => MAP[c]).toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
// What a writer pastes: no diacritics or invisible marks, original letters.
const plain = (s) => s.replace(DIAC, "").replace(/[‎‏]/g, "").replace(/\s+/g, " ").trim();

const CITE = {
  bukhari: "رواه البخاري", muslim: "رواه مسلم", abudawud: "رواه أبو داود", tirmidhi: "رواه الترمذي",
  nasai: "رواه النسائي", ibnmajah: "رواه ابن ماجه", malik: "رواه مالك", ahmad: "رواه أحمد",
};
const EN_CITE = {
  bukhari: "Sahih al-Bukhari", muslim: "Sahih Muslim", abudawud: "Sunan Abi Dawud", tirmidhi: "Jami at-Tirmidhi",
  nasai: "Sunan an-Nasa'i", ibnmajah: "Sunan Ibn Majah",
};

// --- load corpus --------------------------------------------------------------
const passages = [];
const rl = readline.createInterface({ input: fs.createReadStream(CORPUS, "utf8"), crlfDelay: Infinity });
for await (const line of rl) if (line.trim()) passages.push(JSON.parse(line));
const quran = passages.filter((p) => p.kind === "quran");
const hadith = passages.filter((p) => p.kind === "hadith" && (p.extra.sources || []).length);
const allNorm = passages.map((p) => p.text_ar_norm);
const allEnNorm = passages.map((p) => p.text_en_norm || "");
const countAr = (n) => allNorm.reduce((c, t) => c + (t.includes(n) ? 1 : 0), 0);
const countEn = (n) => allEnNorm.reduce((c, t) => c + (t.includes(n) ? 1 : 0), 0);
const surahName = (p) => SURAHS[p.book - 1].name;
// Same format as services/api/app/rules.py passage_reference().
const ref = (p) => (p.kind === "quran"
  ? `${surahName(p)}: ${p.number}`
  : `${p.extra.attribution} (موسوعة الأحاديث النبوية، رقم ${p.number})`);
const sources = (p) => p.extra.sources || [];

// The Prophet's words in HadeethEnc text are inside «…». Take the longest segment.
function matn(p) {
  const quoted = [...p.text_ar.matchAll(/«([^»]+)»/g)].map((m) => m[1].trim());
  const best = quoted.sort((a, b) => b.length - a.length)[0];
  return best && best.split(/\s+/).length >= 8 ? best : null;
}
const tokenize = (s) => plain(s).replace(/\s+[.,،:؛]+(?=\s|$)/g, "").split(" ").filter((w) => /\p{L}/u.test(w));
// A unique excerpt of 7-12 words from the matn (unique in the whole corpus = unambiguous gold answer).
function excerpt(p) {
  const m = matn(p);
  if (!m) return null;
  const words = tokenize(m);
  if (words.length < 8) return null;
  const len = 7 + Math.floor(rand() * 6);
  const start = rand() < 0.7 ? 0 : Math.floor(rand() * Math.max(1, words.length - len));
  const text = words.slice(start, start + len).join(" ").replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
  const n = norm(text);
  if (n.split(" ").length < 6 || countAr(n) !== 1) return null;
  return text;
}
function sample(pool, n, fn) {
  const out = [];
  for (const p of shuffle(pool)) {
    if (out.length >= n) break;
    const r = fn(p);
    if (r) out.push(r);
  }
  return out;
}
const withExcerpt = (p) => { const e = excerpt(p); return e && [p, e]; };

const items = [];
const add = (category, text, expected, notes = "") => items.push({ category, text, expected, notes });
const H = "قال رسول الله ﷺ";
const H_ = (status, quote, p, type = "hadith") => [{ quote, type, status, reference: p ? ref(p) : null, needs_review: false }];

// 1. exact excerpt, cited with the approved takhrij (Sahihayn)
const sahihayn = hadith.filter((p) => sources(p).some((s) => s === "bukhari" || s === "muslim"));
for (const [p, ex] of sample(sahihayn, 15, withExcerpt))
  add("hadith_exact", `${H}: «${ex}» (${p.extra.attribution}).`, H_("matches_source", ex, p));

// 2. altered wording
const ADDITIONS = ["يوم القيامة", "في كل حال", "من الخير", "أبدا", "إن شاء الله"];
for (const [p, ex] of sample(hadith, 15, withExcerpt)) {
  const w = ex.split(" ");
  let altered;
  if (rand() < 0.5) altered = [...w, pick(ADDITIONS)].join(" ");
  else { const i = 1 + Math.floor(rand() * (w.length - 2)); altered = [...w.slice(0, i), pick(["الصادق", "دائما", "حقا"]), ...w.slice(i + 1)].join(" "); }
  add("hadith_altered", `${H}: «${altered}».`, H_("wording_differs", altered, p), `source: ${ex}`);
}

// 3. a book that the approved takhrij does not name
const onlyOne = (p, key) => sources(p).length === 1 && sources(p)[0] === key;
for (const [p, ex] of sample(hadith.filter((p) => onlyOne(p, "muslim") || onlyOne(p, "bukhari")), 10, withExcerpt)) {
  const wrong = onlyOne(p, "muslim") ? "رواه البخاري" : "رواه مسلم";
  add("hadith_wrong_collection", `${H}: «${ex}» (${wrong}).`, H_("reference_mismatch", ex, p));
}

// 4. hadith from the Sunan, cited correctly
const sunan = hadith.filter((p) => !sources(p).some((s) => s === "bukhari" || s === "muslim") && CITE[sources(p)[0]]);
for (const [p, ex] of sample(sunan, 10, withExcerpt))
  add("hadith_sunan", `${H}: «${ex}» (${CITE[sources(p)[0]]}).`, H_("matches_source", ex, p));

// 5. texts presented as hadith that are not in the approved sources
const SAYINGS = [
  "النظافة من الإيمان", "حب الوطن من الإيمان", "اختلاف أمتي رحمة", "الدين المعاملة",
  "اطلبوا العلم من المهد إلى اللحد", "تفاءلوا بالخير تجدوه", "اعمل لدنياك كأنك تعيش أبدا واعمل لآخرتك كأنك تموت غدا",
  "من تعلم لغة قوم أمن مكرهم", "العلم في الصغر كالنقش على الحجر", "خير الأمور أوسطها",
  "طلب العلم فريضة على كل مسلم", "اطلبوا العلم ولو في الصين",
];
let nf = 0;
for (const s of SAYINGS) {
  if (nf >= 10) break;
  if (countAr(norm(s)) > 0) continue; // present in the approved corpus: not a valid not_found case
  add("not_in_corpus", `${H}: «${s}».`, H_("not_found", s, null), "Absent from the approved sources.");
  nf++;
}

// 6-7. Quran: correct and wrong ayah numbers (unique ayat of 6+ words, copied from the mushaf text)
const uniqueAyat = shuffle(quran.filter((p) => p.text_ar_norm.split(" ").length >= 6 && countAr(p.text_ar_norm) === 1));
for (const p of uniqueAyat.slice(0, 10))
  add("quran_correct", `قال تعالى: ﴿${plain(p.text_ar)}﴾ [${surahName(p)}: ${p.number}].`, H_("matches_source", plain(p.text_ar), p, "quran"));
for (const p of uniqueAyat.slice(10, 20)) {
  const wrongAyah = p.number + 1 + Math.floor(rand() * 9);
  add("quran_wrong_ayah", `قال تعالى: ﴿${plain(p.text_ar)}﴾ [${surahName(p)}: ${wrongAyah}].`, H_("reference_mismatch", plain(p.text_ar), p, "quran"));
}

// 8. hadith presented as Quran
for (const [p, ex] of sample(hadith, 5, withExcerpt))
  add("hadith_as_quran", `قال تعالى: «${ex}».`, H_("reference_mismatch", ex, p, "quran"));

// 9. English hadith quotes (HadeethEnc approved translation)
const enOk = (p) => p.text_en && EN_CITE[sources(p)[0]];
for (const [p, ex] of sample(hadith.filter(enOk), 10, (p) => {
  const m = p.text_en.match(/"([^"]{40,400})"/);
  if (!m) return null;
  const e = m[1].split(/\s+/).slice(0, 10 + Math.floor(rand() * 6)).join(" ").replace(/[^\p{L}\p{N}]+$/u, "");
  if (e.split(" ").length < 8 || countEn(norm(e)) !== 1) return null;
  return [p, e];
}))
  add("english", `The Prophet (ﷺ) said: "${ex}" (${EN_CITE[sources(p)[0]]}).`, H_("matches_source", ex, p));

// 10. English verse quotes (QuranEnc english_saheeh), cited as surah:ayah
for (const p of shuffle(quran.filter((p) => p.text_en && p.text_en.split(" ").length >= 10 && countEn(norm(p.text_en)) === 1)).slice(0, 5))
  add("english_quran", `Allah says in the Quran: "${p.text_en}" (${p.book}:${p.number}).`, H_("matches_source", p.text_en, p, "quran"));

// 11. full scripts: 5 documents combining items from the categories above (detection recall)
const scripts = [];
const pool = shuffle(items.filter((i) => !i.category.startsWith("english")));
for (let s = 0; s < 5; s++) {
  const parts = pool.slice(s * 5, s * 5 + 5);
  const intro = ["ومن المعاني التي يحتاجها الناس اليوم:", "وفي هذا الباب نصوص كثيرة، منها:", "ولنتأمل هذه النصوص:"];
  scripts.push({
    category: "script",
    text: parts.map((p) => `${pick(intro)} ${p.text}`).join("\n\n"),
    expected: parts.flatMap((p) => p.expected),
    notes: "Multi-item document.",
  });
}

// --- write with a deterministic 70/30 dev/test split, stratified by category ----
const all = [...items, ...scripts];
const byCat = {};
for (const it of all) (byCat[it.category] ??= []).push(it);
const lines = [];
let k = 0;
for (const [cat, list] of Object.entries(byCat)) {
  list.forEach((it, i) => {
    const split = i < Math.round(list.length * 0.7) ? "dev" : "test";
    lines.push(JSON.stringify({ id: `g-${String(++k).padStart(3, "0")}`, split, ...it, origin: "auto", corpus: version }));
  });
}
fs.writeFileSync(OUT, lines.join("\n") + "\n", "utf8");
const counts = Object.fromEntries(Object.entries(byCat).map(([c, l]) => [c, l.length]));
const nItems = all.reduce((n, c) => n + c.expected.length, 0);
console.log(`gold: ${all.length} cases, ${nItems} expected items`, counts);
