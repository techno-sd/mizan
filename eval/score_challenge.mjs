// Score the "popular claims" challenge set (eval/challenge.jsonl): texts that circulate in Islamic content and that
// a reviewer must catch. Same scorer for Mizan and for a general model.
//   node eval/score_challenge.mjs                       # writes eval/results/CHALLENGE.md
//
// Responses: eval/results/responses-mizan-challenge/run<N>/<id>.json (Mizan, live API)
//            eval/results/responses-baseline-plain-challenge/run1/<id>.json (eval/baselines/run_baseline.mjs --grade)
//
// What is counted, per case (the quote's finding is the one sharing most words with the case quote):
// - no_basis (fabricated, baseless or weak texts not in the hadith books checked):
//     attributed    = presented as found in a source (any status other than not_found, or a reference given)
//     authenticated = called authentic (a «صحيح/حسن» grade from the model; for Mizan, "matches" with an accepted grading)
// - wrong_book (authentic hadith cited to a book it is not in): caught = reference_mismatch and the first book
//     named is one the text is in
// - quran_issue (wrong surah/ayah, altered wording, hadith presented as a verse): caught = the expected status and,
//     when a reference is given, the right one
// - control (correct quotes): correct = matches_source; anything else is a false alarm
// - invented reference: the main (first) reference given points to a book (among the seven checked) or a surah:ayah
//     where the text is not; for a baseless saying, any book given. Books outside the seven (e.g. Musnad Ahmad) are
//     not counted either way.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cases = fs.readFileSync(path.join(repo, "eval/challenge.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
const surahs = JSON.parse(fs.readFileSync(path.join(repo, "services/api/app/data/surahs.json"), "utf8")).surahs;

const norm = (s) => (s || "").replace(/[ً-ٰٟۖ-ۭـ]/g, "").replace(/[أإآٱ]/g, "ا")
  .replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
  .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[^ء-ي0-9: ]/g, " ").replace(/\s+/g, " ").trim();

const BOOKS = { bukhari: ["البخاري"], muslim: ["مسلم"], abudawud: ["ابي داود", "ابو داود", "ابي داوود", "ابو داوود"],
  tirmidhi: ["الترمذي"], nasai: ["النسايي", "النساءي"], ibnmajah: ["ابن ماجه", "ابن ماجة"], malik: ["مالك", "الموطا"] };
function books(ref) {
  const t = ` ${norm(ref)} `;
  const found = [];
  const at = (k, i) => { if (i > -1 && !found.some((f) => f.k === k)) found.push({ k, i }); };
  const agreed = t.indexOf(" متفق عليه ");
  at("bukhari", agreed); at("muslim", agreed);
  for (const [k, names] of Object.entries(BOOKS))
    for (const n of names) at(k, t.indexOf(` ${norm(n)} `) > -1 ? t.indexOf(` ${norm(n)} `) : t.indexOf(norm(n)));
  return found.sort((a, b) => a.i - b.i).map((f) => f.k);
}
const surahIndex = surahs.map((s) => [norm(s.name).replace(/^ال/, ""), s.number]).sort((a, b) => b[0].length - a[0].length);
function quranRef(ref) {
  const t = norm(ref);
  const m = t.match(/(\d{1,3})\s*:\s*(\d{1,3})/);
  for (const [name, n] of surahIndex) {
    const i = t.replace(/(^| )ال/g, "$1").indexOf(name);
    if (i > -1) { const a = t.replace(/(^| )ال/g, "$1").slice(i + name.length).match(/(\d{1,3})/); if (a) return `${n}:${a[1]}`; }
  }
  return m ? `${m[1]}:${m[2]}` : null;
}

function pick(findings, quote) {
  const q = new Set(norm(quote).split(" "));
  let best = null, score = 0;
  for (const f of findings || []) {
    const w = norm(f.quoted_text).split(" ");
    const s = w.filter((x) => q.has(x)).length / Math.max(q.size, 1);
    if (s > score) { best = f; score = s; }
  }
  return score >= 0.5 ? best : null;
}

const ACCEPTED = /صحيح|حسن|sahih|hasan/i;
function judge(c, f, isMizan) {
  const r = { id: c.id, category: c.category, status: f?.status ?? "missed", ref: f?.suggested_reference ?? "", grade: f?.grade ?? "" };
  if (!f) return { ...r, ok: false, invented: false };
  const named = books(r.ref);
  const first = (r.ref || "").split("؛")[0];
  const truthBooks = c.truth.books || [];
  const qref = first && c.presented_as === "quran" ? quranRef(first) : null;
  let invented = false;
  if (c.category === "no_basis") invented = named.length > 0;
  else if (c.truth.quran) invented = Boolean(qref && qref !== c.truth.quran);
  else invented = books(first).some((b) => !truthBooks.includes(b));
  if (c.category === "no_basis") {
    const attributed = r.status !== "not_found" || named.length > 0;
    const authenticated = isMizan
      ? r.status === "matches_source" && (f.gradings || []).some((g) => g.category === "accepted")
      : ACCEPTED.test(r.grade) && !/ضعيف|موضوع|لا اصل|لا أصل/.test(r.grade);
    return { ...r, ok: !attributed && !authenticated, attributed, authenticated, invented };
  }
  if (c.category === "wrong_book")
    return { ...r, ok: r.status === "reference_mismatch" && truthBooks.includes(named[0]), invented };
  if (c.category === "quran_issue") {
    const want = c.truth.expected_status;
    const refOk = c.truth.quran ? !qref || qref === c.truth.quran : truthBooks.includes(named[0]);
    const needRef = want === "reference_mismatch" && c.truth.quran ? qref === c.truth.quran : true;
    return { ...r, ok: r.status === want && refOk && needRef, invented };
  }
  return { ...r, ok: r.status === "matches_source" && !invented, invented };
}

function load(dir, id) {
  const file = path.join(repo, dir, `${id}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}
const systems = [
  { name: "Mizan", dir: "eval/results/responses-mizan-challenge/run1", mizan: true },
  { name: "Claude, directly (same model)", dir: "eval/results/responses-baseline-plain-challenge/run1", mizan: false },
];
const results = systems.map((s) => ({ ...s, rows: cases.map((c) => judge(c, pick(load(s.dir, c.id)?.findings, c.quote), s.mizan)) }));

// Mizan: same status and reference across its runs.
const runs = fs.readdirSync(path.join(repo, "eval/results/responses-mizan-challenge")).filter((d) => d.startsWith("run"));
const stable = cases.filter((c) => {
  const seen = runs.map((r) => { const f = pick(load(`eval/results/responses-mizan-challenge/${r}`, c.id)?.findings, c.quote); return `${f?.status}|${f?.suggested_reference}`; });
  return seen.every((x) => x === seen[0]);
}).length;

const count = (rows, cat, key = "ok") => rows.filter((x) => x.category === cat && x[key]).length;
const n = (cat) => cases.filter((c) => c.category === cat).length;
const pct = (a, b) => `${a}/${b}`;
const lines = [];
lines.push("# Popular claims: Mizan vs. a general AI model", "");
lines.push(`Run on ${new Date().toISOString().slice(0, 10)}. ${cases.length} short texts in [\`eval/challenge.jsonl\`](../challenge.jsonl), one quote each, of the kind`,
  "that circulates in Islam-introduction content. Same model everywhere (Claude Sonnet 5.5). The general model was also",
  "asked for each hadith's grade (`run_baseline.mjs --grade`), as a user would ask a chatbot. Scored by",
  "[`eval/score_challenge.mjs`](../score_challenge.mjs).", "");
lines.push("| | **Mizan** | Claude, directly |", "|---|---|---|");
const [m, b] = results;
lines.push(`| Fabricated / baseless / weak sayings **attributed to a source** (lower is better) | **${pct(count(m.rows, "no_basis", "attributed"), n("no_basis"))}** | ${pct(count(b.rows, "no_basis", "attributed"), n("no_basis"))} |`);
lines.push(`| … of them **called authentic** (lower is better) | **${pct(count(m.rows, "no_basis", "authenticated"), n("no_basis"))}** | ${pct(count(b.rows, "no_basis", "authenticated"), n("no_basis"))} |`);
lines.push(`| Authentic hadith cited to the wrong book: **caught, with the right book** | **${pct(count(m.rows, "wrong_book"), n("wrong_book"))}** | ${pct(count(b.rows, "wrong_book"), n("wrong_book"))} |`);
lines.push(`| Verse issues (wrong surah/ayah, altered wording, hadith presented as a verse): **caught** | **${pct(count(m.rows, "quran_issue"), n("quran_issue"))}** | ${pct(count(b.rows, "quran_issue"), n("quran_issue"))} |`);
lines.push(`| Correct quotes confirmed (no false alarm) | **${pct(count(m.rows, "control"), n("control"))}** | ${pct(count(b.rows, "control"), n("control"))} |`);
lines.push(`| **Invented references** (a book or surah:ayah where the text is not) | **${m.rows.filter((x) => x.invented).length}** | ${b.rows.filter((x) => x.invented).length} |`);
lines.push(`| Same result across 3 runs | **${stable}/${cases.length}** | not measured |`, "");
lines.push("## Every case", "", "| id | category | Mizan | Claude, directly |", "|---|---|---|---|");
const cell = (x) => `${x.ok ? "✅" : "❌"} ${x.status}${x.ref ? ` · ${x.ref.slice(0, 70)}` : ""}${x.grade ? ` · ${x.grade}` : ""}${x.invented ? " · **invented ref**" : ""}`;
cases.forEach((c, i) => lines.push(`| ${c.id} | ${c.category} | ${cell(m.rows[i])} | ${cell(b.rows[i])} |`));
lines.push("", "## Reading these numbers", "",
  "- **Labels.** Verdicts for the sayings come from the standard works on weak and fabricated hadith, and every",
  "  location was checked against the hadith books themselves (see `basis` in each case). They are pending review by a",
  "  specialist; a corrected label changes the numbers above, and the scorer can be re-run.",
  "- **Mizan does not judge authenticity.** For a saying it cannot find it says «لم يُعثر عليه» and that this does not",
  "  mean fabricated. The safe outcome counted here is \"not attributed to a source\", which is what a reviewer needs.",
  "- **Small set** (37 texts). An indication, not a general claim.");
fs.writeFileSync(path.join(repo, "eval/results/CHALLENGE.md"), lines.join("\n") + "\n");
console.log(lines.slice(0, 16).join("\n"));
