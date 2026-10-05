"use client";

import { STATUS, TYPE_LABEL, markClass } from "@/lib/labels";
import type { Finding } from "@/lib/types";

interface Props {
  text: string;
  findings: Finding[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

// The checked text, with each finding's span highlighted by status. Highlights are keyboard-accessible.
export default function HighlightedText({ text, findings, activeId, onSelect }: Props) {
  const spans = findings.filter((f) => f.span).sort((a, b) => a.span!.start - b.span!.start);

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const f of spans) {
    const start = Math.max(f.span!.start, cursor);
    const end = f.span!.end;
    if (end <= start) continue;
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark
        key={f.id}
        id={`mark-${f.id}`}
        role="button"
        tabIndex={0}
        data-active={activeId === f.id}
        aria-label={`${TYPE_LABEL[f.type]}: ${STATUS[f.status].label}. اعرض التفاصيل`}
        className={`finding-mark ${markClass(f)}`}
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
    cursor = end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));

  return (
    <div dir="auto" className="whitespace-pre-wrap text-[1.08rem] leading-[2.2]">
      {parts}
    </div>
  );
}
