export type StabilityVerdict = "yes" | "no" | "pending";

export interface StabilityEvidence {
  issue: string;
  repo: string;
  number: number;
  url: string;
  title?: string;
  area: string;
  type: "channel-specific" | "tool-specific" | "kernel" | "runtime" | "docs" | "other";
  severity: 1 | 2 | 3 | 4 | 5;
  penalty: number;
  reason: string;
}

export interface StabilityScore {
  schemaVersion: "isitstable:v1";
  baseScore: number;
  score: number;
  verdict: StabilityVerdict;
  votePenalty: number;
  evidencePenalty: number;
  affected: string[];
  evidence: StabilityEvidence[];
  notes?: string;
}

const SCORE_BLOCK_RE = /<!--\s*isitstable:v1\s*([\s\S]*?)\s*-->/m;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseIssueRef(raw: string): { repo: string; number: number; url: string } | null {
  const match = raw.match(/^([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)#(\d+)$/);
  if (!match) return null;
  return {
    repo: match[1],
    number: Number(match[2]),
    url: `https://github.com/${match[1]}/issues/${match[2]}`,
  };
}

function computeVotePenalty(thumbsUp: number, thumbsDown: number): number {
  return Math.max(0, thumbsDown - thumbsUp) * 2;
}

function computeScore(baseScore: number, evidencePenalty: number, votePenalty: number): number {
  return Math.max(0, Math.min(100, baseScore - evidencePenalty - votePenalty));
}

function normalizeStabilityScore(raw: unknown, thumbsUp: number, thumbsDown: number, fallbackVerdict: StabilityVerdict): StabilityScore | null {
  if (!isRecord(raw)) return null;
  const evidenceRaw = Array.isArray(raw.evidence) ? raw.evidence : [];
  const evidence: StabilityEvidence[] = evidenceRaw.flatMap((item): StabilityEvidence[] => {
    if (!isRecord(item) || typeof item.issue !== "string") return [];
    const ref = parseIssueRef(item.issue);
    if (!ref) return [];
    const penalty = Math.max(0, Number(item.penalty ?? 0));
    const severity = Math.max(1, Math.min(5, Number(item.severity ?? Math.min(5, Math.max(1, penalty))))) as 1 | 2 | 3 | 4 | 5;
    return [{
      issue: item.issue,
      ...ref,
      title: typeof item.title === "string" ? item.title : undefined,
      area: typeof item.area === "string" ? item.area : "unknown",
      type: typeof item.type === "string" ? item.type as StabilityEvidence["type"] : "other",
      severity,
      penalty,
      reason: typeof item.reason === "string" ? item.reason : "Stability risk",
    }];
  });

  const baseScore = Number(raw.baseScore ?? 100);
  const votePenalty = computeVotePenalty(thumbsUp, thumbsDown);
  const evidencePenalty = evidence.reduce((sum, item) => sum + item.penalty, 0);
  const score = computeScore(baseScore, evidencePenalty, votePenalty);
  const affected = Array.isArray(raw.affected)
    ? raw.affected.filter((item): item is string => typeof item === "string")
    : Array.from(new Set(evidence.map((item) => item.area).filter(Boolean)));

  const verdict = raw.verdict === "yes" || raw.verdict === "no" || raw.verdict === "pending"
    ? raw.verdict
    : fallbackVerdict;

  return {
    schemaVersion: "isitstable:v1",
    baseScore,
    score,
    verdict,
    votePenalty,
    evidencePenalty,
    affected,
    evidence,
    notes: typeof raw.notes === "string" ? raw.notes : undefined,
  };
}

export function parseStabilityBlock(body: string | null, thumbsUp: number, thumbsDown: number, fallbackVerdict: StabilityVerdict): StabilityScore | null {
  if (!body) return null;
  const match = body.match(SCORE_BLOCK_RE);
  if (!match) return null;
  try {
    return normalizeStabilityScore(JSON.parse(match[1]), thumbsUp, thumbsDown, fallbackVerdict);
  } catch {
    return null;
  }
}

export function fallbackStabilityScore(thumbsUp: number, thumbsDown: number, verdict: StabilityVerdict): StabilityScore {
  const votePenalty = computeVotePenalty(thumbsUp, thumbsDown);
  return {
    schemaVersion: "isitstable:v1",
    baseScore: 100,
    score: computeScore(100, 0, votePenalty),
    verdict,
    votePenalty,
    evidencePenalty: 0,
    affected: [],
    evidence: [],
  };
}
