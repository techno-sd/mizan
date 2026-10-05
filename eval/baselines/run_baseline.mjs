// Baseline: the same Claude model used directly as a general assistant (no Mizan pipeline, no corpus).
//   cd eval/baselines && npm install
//   node run_baseline.mjs --split test --variant plain     # no tools
//   node run_baseline.mjs --split test --variant search    # with Anthropic's web search tool
// Responses are written in Mizan's response shape and scored with the same code:
//   python eval/run_eval.py --split test --runs 1 --responses eval/results/responses-baseline-<variant>-test --tag baseline-<variant>
//
// Fairness: same model as Mizan (claude-sonnet-5-5), same prompt for both variants, same scorer.
// No server-side fallback: a refusal is recorded as a failure instead of silently switching models.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const split = arg("split", "test");
const variant = arg("variant", "plain");
const model = arg("model", "claude-sonnet-5-5");
const outDir = path.join(repo, "eval", "results", `responses-baseline-${variant}-${split}`, "run1");

// API key: environment, or services/api/.env (git-ignored).
if (!process.env.ANTHROPIC_API_KEY) {
  const envFile = path.join(repo, "services", "api", ".env");
  const line = fs.existsSync(envFile) && fs.readFileSync(envFile, "utf8").split(/\r?\n/).find((l) => l.startsWith("ANTHROPIC_API_KEY="));
  if (line) process.env.ANTHROPIC_API_KEY = line.slice("ANTHROPIC_API_KEY=".length).trim();
}
const client = new Anthropic();

const PROMPT = `راجع النص التالي قبل نشره. لكل آية أو حديث أو قول منسوب فيه، حدّد:
- status: واحدة من:
  matches_source (النص موجود بلفظه في مصدره والإحالة المذكورة صحيحة)،
  wording_differs (النص موجود في مصدره لكن بلفظ مختلف)،
  reference_mismatch (النص موجود لكن الإحالة المذكورة خاطئة: كتاب آخر أو سورة/آية أخرى، أو قُدِّم حديث على أنه آية أو العكس)،
  not_found (لم تجد له أصلًا في القرآن أو كتب الحديث).
- reference: الإحالة الصحيحة بهذه الصيغة فقط: "اسم الكتاب رقم الحديث" مثل "صحيح البخاري 1" أو "صحيح مسلم 2564" أو "سنن ابن ماجه 224"، أو "اسم السورة: رقم الآية" مثل "البقرة: 255". استخدم أسماء الكتب: صحيح البخاري، صحيح مسلم، سنن أبي داود، جامع الترمذي، سنن النسائي، سنن ابن ماجه، موطأ مالك. اتركها فارغة إن لم تعرفها.
- quote: نص الاقتباس كما ورد في النص.

أجب بكائن JSON فقط، دون أي نص آخر، بهذا الشكل:
{"items":[{"quote":"...","status":"...","reference":"..."}]}

النص:
<<<
{TEXT}
>>>`;

function parseJson(text) {
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function ask(text) {
  const messages = [{ role: "user", content: PROMPT.replace("{TEXT}", text) }];
  const tools = variant === "search" ? [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }] : undefined;
  let response;
  for (let turn = 0; turn < 6; turn++) {
    response = await client.messages.create({ model, max_tokens: 16000, messages, ...(tools ? { tools } : {}) });
    if (response.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: response.content }); // resume a paused server-tool turn
  }
  if (response.stop_reason === "refusal") throw new Error("refusal");
  const textBlocks = response.content.filter((b) => b.type === "text").map((b) => b.text);
  return parseJson(textBlocks.join("\n"));
}

const cases = fs.readFileSync(path.join(repo, "eval", "gold.jsonl"), "utf8").trim().split("\n").map(JSON.parse)
  .filter((c) => split === "all" || c.split === split);
fs.mkdirSync(outDir, { recursive: true });

let done = 0;
const queue = [...cases];
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) {
    const c = queue.shift();
    const file = path.join(outDir, `${c.id}.json`);
    if (fs.existsSync(file)) { done++; continue; }
    const t = Date.now();
    let findings = [], error = null;
    try {
      const out = await ask(c.text);
      findings = (out.items || []).map((it, i) => ({
        id: `b${i + 1}`, quoted_text: it.quote || "", status: it.status || "not_found",
        suggested_reference: it.reference || null, needs_scholar_review: false,
      }));
    } catch (e) {
      error = String(e.message || e);
    }
    fs.writeFileSync(file, JSON.stringify({ findings, llm_used: true, baseline: variant, model, error, _latency_s: +((Date.now() - t) / 1000).toFixed(2) }));
    done++;
    if (error) console.log(`${c.id}: ${error}`);
  }
}));
console.log(`baseline ${variant}/${split}: ${done} cases -> ${outDir}`);
