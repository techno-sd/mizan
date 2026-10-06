"use client";

import { STATUS, TYPE_LABEL } from "@/lib/labels";
import { issueHighlights } from "@/lib/issue-highlights";
import type { Finding } from "@/lib/types";

interface Props {
  text: string;
  findings: Finding[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

// Highlight the located issue, preserving the original text and keyboard navigation.
export default function HighlightedText({ text, findings, activeId, onSelect }: Props) {
  const spans = issueHighlights(text, findings);

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  const rendered = new Set<string>();
  for (const { finding: f, span, className } of spans) {
    const start = Math.max(span.start, cursor);
    const end = span.end;
    if (end <= start) continue;
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark
        key={`${f.id}-${span.start}`}
        id={rendered.has(f.id) ? `mark-${f.id}-${span.start}` : `mark-${f.id}`}
        role="button"
        tabIndex={0}
        data-active={activeId === f.id}
        aria-label={`${TYPE_LABEL[f.type]}: ${STATUS[f.status].label}. اعرض التفاصيل`}
        className={`finding-mark ${className}`}
        onClick={() => onSelect(f.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(f.id);
          }
        }}
      >
        {text.slice(start, end)}
      </mark>,
    );
    rendered.add(f.id);
    cursor = end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));

  return (
    <div dir="auto" className="whitespace-pre-wrap text-[1.08rem] leading-[2.2]">
      {parts}
    </div>
  );
}
