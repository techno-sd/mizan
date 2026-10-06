// Mirror of services/api/app/schemas.py (API v1). Keep in sync.

export type ItemType = "quran" | "hadith" | "attributed_quote" | "general_claim";

export type ReferenceStatus =
  | "matches_source"
  | "wording_differs"
  | "reference_mismatch"
  | "not_found"
  | "out_of_scope";

export type MatchType = "exact" | "variant" | "partial" | "semantic";

export interface Span {
  // Unicode code-point offsets from Python; convert to UTF-16 before JavaScript slicing.
  start: number;
  end: number;
}

export interface Grading {
  scholar: string;
  grade: string;
  scholar_ar: string | null;
  grade_ar: string | null;
  source_label: string | null;
  source_approved: boolean;
  category: "accepted" | "weak" | "rejected" | "unknown";
}

export interface DiffOp {
  op: "equal" | "insert" | "delete";
  text: string;
}

export interface Evidence {
  passage_id: number;
  collection: string;
  collection_label: string;
  reference: string;
  number: number | null;
  numbering_scheme: string | null;
  text: string;
  text_en: string | null;
  url: string | null;
  similarity: number;
  match_type: MatchType;
  context_before: string | null;
  context_after: string | null;
  highlight: Span | null;
  highlight_lang: "ar" | "en" | null;
  takhrij: string | null;
  source_id: string;
  source_label: string;
  source_url: string;
  source_approved: boolean;
}

export interface Finding {
  id: string;
  type: ItemType;
  span: Span | null;
  quoted_text: string;
  attributed_to: string | null;
  cited_reference: string | null;
  status: ReferenceStatus;
  needs_scholar_review: boolean;
  review_reasons: string[];
  evidence: Evidence[];
  nearest: Evidence | null;
  gradings: Grading[];
  diff: DiffOp[];
  suggested_reference: string | null;
  notes: string[];
}

export interface VerifyResponse {
  api_version: string;
  pipeline_version: string;
  run_id: string;
  corpus_version: string;
  corpus_scope: string[];
  llm_used: boolean;
  summary: {
    total: number;
    by_status: Record<ReferenceStatus, number>;
    needs_scholar_review: number;
  };
  findings: Finding[];
  trace: unknown[] | null;
}
