import type { Span } from "./types";

// The Python API returns Unicode code-point offsets. JavaScript slices UTF-16 code units.
// Convert against the original string before highlighting or applying any edit.
export function toUtf16Span(text: string, span: Span | null): Span | null {
  if (!span || !Number.isInteger(span.start) || !Number.isInteger(span.end) || span.start < 0 || span.end < span.start)
    return null;
  let points = 0, units = 0;
  let start: number | undefined;
  for (const character of text) {
    if (points === span.start) start = units;
    if (points === span.end) return { start: start ?? units, end: units };
    units += character.length;
    points++;
  }
  if (points === span.start) start = units;
  return points === span.end && start !== undefined ? { start, end: units } : null;
}

// quoteSpan is already converted to UTF-16. Only associate an adjacent citation with this quote.
export function citedReferenceSpan(text: string, quoteSpan: Span | null, reference: string | null): Span | null {
  if (!quoteSpan || !reference) return null;
  const from = quoteSpan.end;
  const tail = text.slice(from, from + 60 + reference.length);
  const offset = tail.indexOf(reference);
  const adjacent = offset >= 0 && /^[\s»”"'﴾:،,\[(]*$/.test(tail.slice(0, offset));
  let start: number;
  if (adjacent) start = from + offset;
  else {
    // An unbracketed quotation may have its trailing reference included in the API span.
    const within = text.slice(quoteSpan.start, quoteSpan.end);
    const inside = within.lastIndexOf(reference);
    if (inside < 0 || !/^[\s\])»”"'﴾.،,؛;]*$/.test(within.slice(inside + reference.length))) return null;
    start = quoteSpan.start + inside;
  }
  let end = start + reference.length;
  let before = start - 1, after = end;
  while (before >= 0 && /[ \t]/.test(text[before])) before--;
  while (after < text.length && /[ \t]/.test(text[after])) after++;
  if ((text[before] === "[" && text[after] === "]") || (text[before] === "(" && text[after] === ")")) {
    start = before;
    end = after + 1;
  }
  return { start, end };
}
