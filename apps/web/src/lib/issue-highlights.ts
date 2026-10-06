import { markClass, gradingSummary } from "./labels";
import { citedReferenceSpan, toUtf16Span } from "./spans";
import type { Finding, Span } from "./types";

export interface IssueHighlight {
  finding: Finding;
  span: Span; // UTF-16 offsets in the untouched original document
  className: string;
}

const normalizeWord = (word: string) => word.toLowerCase()
  .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06edـ]/g, "")
  .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
  .replace(/ؤ/g, "و").replace(/ئ/g, "ي");

function words(text: string) {
  return Array.from(text.matchAll(/[\p{L}\p{N}\p{M}]+/gu), (match) => ({
    value: normalizeWord(match[0]), start: match.index, end: match.index + match[0].length,
  })).filter((word) => word.value);
}

// Diff inserts are words in the user's quotation that are absent/different in the source.
// Equal operations anchor repeated words. Ambiguous or missing words never create a guessed highlight.
function changedWords(text: string, quote: Span, finding: Finding): Span[] {
  const tokens = words(text.slice(quote.start, quote.end));
  const ranges: Span[] = [];
  let cursor = 0;
  for (const operation of finding.diff) {
    if (operation.op === "delete") continue;
    const needle = words(operation.text).map((word) => word.value);
    if (!needle.length) continue;
    const positions: number[] = [];
    for (let at = cursor; at <= tokens.length - needle.length; at++) {
      if (needle.every((word, index) => tokens[at + index].value === word)) positions.push(at);
    }
    const at = positions[0];
    if (at === undefined || (operation.op === "insert" && positions.length > 1 && at !== cursor)) continue;
    if (operation.op === "insert") ranges.push({
      start: quote.start + tokens[at].start,
      end: quote.start + tokens[at + needle.length - 1].end,
    });
    cursor = at + needle.length;
  }
  return ranges;
}

export function issueHighlights(text: string, findings: Finding[]): IssueHighlight[] {
  const highlights: IssueHighlight[] = [];
  for (const finding of findings) {
    const quote = toUtf16Span(text, finding.span);
    if (!quote || quote.end <= quote.start) continue;
    const add = (span: Span, className: string) => highlights.push({ finding, span, className });
    if (finding.status === "reference_mismatch") {
      const reference = citedReferenceSpan(text, quote, finding.cited_reference);
      if (reference) add(reference, "mark-amber");
      if (finding.evidence[0]?.match_type === "variant") {
        for (const span of changedWords(text, quote, finding)) add(span, "mark-amber");
      }
      // Keep navigation available when the reference cannot be located, without coloring correct words.
      if (!highlights.some((item) => item.finding.id === finding.id)) add(quote, "finding-mark-plain");
    } else if (finding.status === "wording_differs" && !finding.needs_scholar_review) {
      const changed = changedWords(text, quote, finding);
      if (changed.length) changed.forEach((span) => add(span, "mark-amber"));
      else add(quote, "finding-mark-plain");
    } else if (finding.status === "matches_source" && !finding.needs_scholar_review && !gradingSummary(finding)) {
      add(quote, "finding-mark-plain");
    } else {
      // Uncertain attribution or grading applies to the quotation as a whole.
      add(quote, markClass(finding));
    }
  }
  return highlights.sort((a, b) => a.span.start - b.span.start);
}
