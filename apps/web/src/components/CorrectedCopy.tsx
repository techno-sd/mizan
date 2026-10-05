"use client";

import { useMemo, useState } from "react";

import { CopyButton } from "@/components/FindingCard";
import { Chevron, External, Shield } from "@/components/Icons";
import { buildCorrected } from "@/lib/corrected";
import type { Finding } from "@/lib/types";

// The checked text with wording and references taken from the sources, and numbered source notes.
export default function CorrectedCopy({ text, findings }: { text: string; findings: Finding[] }) {
  const c = useMemo(() => buildCorrected(text, findings), [text, findings]);
  const [open, setOpen] = useState(false);
  if (!c.notes.length) return null;

  const count = (n: number, one: string, two: string, many: string) => (n === 1 ? one : n === 2 ? two : `${n} ${many}`);
  const summary = [
    c.changed ? `صحّحنا ${count(c.changed, "موضعًا", "موضعين", "مواضع")}` : null,
    c.added ? `أضفنا ${count(c.added, "إحالة", "إحالتين", "إحالات")}` : null,
    c.flagged ? `${count(c.flagged, "موضع يحتاج", "موضعان يحتاجان", "مواضع تحتاج")} قرارك` : null,
  ].filter(Boolean).join(" · ") || "لا تغييرات";

  return (
    <section aria-label="نسخة مصحّحة" className="rounded-2xl border border-border bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-4 py-3 text-start"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Shield className="h-5 w-5" />
        </span>
        <span className="flex-1">
          <span className="block font-semibold">نسخة مصحّحة جاهزة للنشر</span>
          <span className="block text-sm text-muted">{summary} · مع قائمة المصادر</span>
        </span>
        <Chevron className={`h-5 w-5 text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border px-4 pb-4 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs leading-6 text-muted">
              الألفاظ والإحالات منقولة من المصادر نفسها، ولا يكتبها الذكاء الاصطناعي. الأخضر ما صحّحناه (مرّر المؤشر لترى الأصل)،
              والأصفر يحتاج قرارك.
            </p>
            <CopyButton text={c.plain} label="نسخ النص مع المصادر" />
          </div>

          <div dir="auto" className="whitespace-pre-wrap rounded-xl bg-surface-muted px-4 py-3 text-[1.05rem] leading-[2.1]">
            {c.segments.map((s, i) => {
              if (!s.kind) return <span key={i}>{s.text}</span>;
              if (s.kind === "wording" || s.kind === "reference")
                return (
                  <span key={i} className="tone-green rounded px-0.5" title={s.was ? `كان: ${s.was}` : "أُضيف"}>
                    {s.text}
                  </span>
                );
              return (
                <span key={i} className={s.kind === "flag" ? "tone-amber rounded px-1 text-sm font-semibold" : "text-sm font-semibold text-accent"}>
                  {s.text}
                </span>
              );
            })}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">المصادر</h3>
            <ol className="space-y-2 text-sm leading-7">
              {c.notes.map((n) => (
                <li key={n.n} className={`flex gap-2 rounded-lg px-2 py-1 ${n.warn ? "tone-amber" : ""}`}>
                  <span className="font-semibold">[{n.n}]</span>
                  <span className="flex-1">
                    {n.lines.join(" · ")}
                    {n.url && (
                      <a href={n.url} target="_blank" rel="noreferrer" className="ms-1 inline-flex items-center gap-0.5 underline">
                        المصدر <External className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
