// Score eval/fidelity.jsonl (built by eval/build_fidelity.mjs): unchanged verses/hadith must be confirmed, slightly
// changed ones must be reported as "wording differs". Writes eval/results/FIDELITY.md.
//   node eval/score_fidelity.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cases = fs.readFileSync(path.join(repo, "eval/fidelity.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
const norm = (s) => (s || "").replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, "").replace(/[أإآٱ]/g, "ا")
  .replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^ء-ي ]/g, " ").replace(/\s+/g, " ").trim();
function pick(findings, quote) {
  const q = new Set(norm(quote).split(" "));
  let best = null, score = 0;
  for (const f of findings || []) {
    const s = norm(f.quoted_text).split(" ").filter((x) => q.has(x)).length / Math.max(q.size, 1);
    if (s > score) { best = f; score = s; }
  }
  return score >= 0.5 ? best : null;
}
const load = (dir, id) => { const f = path.join(repo, dir, `${id}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null; };
const systems = [
  ["Mizan", "eval/results/responses-mizan-fidelity/run1"],
  ["Claude, directly (same model)", "eval/results/responses-baseline-plain-fidelity/run1"],
];
const rows = systems.map(([name, dir]) => cases.map((c) => {
  const f = pick(load(dir, c.id)?.findings, c.expected[0].quote);
  return { id: c.id, category: c.category, want: c.expected[0].status, got: f?.status ?? "missed", ok: f?.status === c.expected[0].status };
}));
const runs = fs.readdirSync(path.join(repo, "eval/results/responses-mizan-fidelity")).filter((d) => d.startsWith("run"));
const stable = cases.filter((c) => {
  const s = runs.map((r) => pick(load(`eval/results/responses-mizan-fidelity/${r}`, c.id)?.findings, c.expected[0].quote)?.status);
  return s.every((x) => x === s[0]);
}).length;
const cats = [["quran_altered", "Verse changed by one word: **reported as differing**"], ["hadith_altered", "Hadith changed by one word: **reported as differing**"],
  ["quran_exact", "Verse copied exactly: confirmed (no false alarm)"], ["hadith_exact", "Hadith copied exactly: confirmed (no false alarm)"]];
const score = (r, cat) => `${r.filter((x) => x.category === cat && x.ok).length}/${r.filter((x) => x.category === cat).length}`;
const L = ["# Word fidelity: Mizan vs. a general AI model", "",
  `Run on ${new Date().toISOString().slice(0, 10)}. ${cases.length} cases in [\`eval/fidelity.jsonl\`](../fidelity.jsonl), built by`,
  "[`eval/build_fidelity.mjs`](../build_fidelity.mjs): real ayat (QuranEnc) and hadith (HadeethEnc, cited with their approved",
  "takhrij), half of them changed the way people misquote from memory: one particle or pronoun swapped (من/عن، في/على،",
  "لكم/لهم), a near-synonym (يحب/يرضى، قال/يقول), or a small word dropped (قد، إن، هو). Every changed text occurs nowhere in",
  "the corpus, so the right answer is objective. Same model everywhere (Claude Sonnet 5.5).", "",
  "| | **Mizan** | Claude, directly |", "|---|---|---|",
  ...cats.map(([k, label]) => `| ${label} | **${score(rows[0], k)}** | ${score(rows[1], k)} |`),
  `| **All** | **${rows[0].filter((x) => x.ok).length}/${cases.length}** | ${rows[1].filter((x) => x.ok).length}/${cases.length} |`,
  `| Same result across 3 runs | **${stable}/${cases.length}** | not measured |`, "",
  "## Every case", "", "| id | category | change | Mizan | Claude, directly |", "|---|---|---|---|---|",
  ...cases.map((c, i) => `| ${c.id} | ${c.category} | ${(c.notes || "").split("؛")[0]} | ${rows[0][i].ok ? "✅" : "❌"} ${rows[0][i].got} | ${rows[1][i].ok ? "✅" : "❌"} ${rows[1][i].got} |`)];
fs.writeFileSync(path.join(repo, "eval/results/FIDELITY.md"), L.join("\n") + "\n");
console.log(L.slice(8, 16).join("\n"));
