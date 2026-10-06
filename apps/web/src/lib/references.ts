import type { Evidence } from "./types";

// Display formatting only; the original reference remains available for source matching.
export function formatQuranReference(reference: string): string {
  const bare = reference.trim().replace(/^[[(]\s*|\s*[\])]$/g, "").replace(/^سورة\s+/, "");
  const match = bare.match(/^(.+?)\s*:\s*([0-9٠-٩]+(?:\s*[-–]\s*[0-9٠-٩]+)?)$/u);
  return match ? `سورة ${match[1].trim()}: ${match[2].replace(/\s*[-–]\s*/g, "–")}` : reference;
}

export function evidenceReference(ev: Evidence): string {
  return ev.collection === "quran" ? formatQuranReference(ev.reference) : ev.reference;
}
