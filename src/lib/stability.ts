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

export interface StabilityScoreSettings {
  baseScore: number;
  survivalBonus: {
    pointsPerDay: number;
    maxPoints: number;
  };
  curatedBonus: {
    points: number;
  };
}

export interface StabilityFormula {
  baseScore: number;
  evidencePenalty: number;
  votePenalty: number;
  survivalDays: number;
  survivalPointsPerDay: number;
  survivalCreditedDays: number;
  survivalBonus: number;
  curatedBonus: number;
  score: number;
}

export interface StabilityScore {
  schemaVersion: "isitstable:v1";
  baseScore: number;
  score: number;
  verdict: StabilityVerdict;
  votePenalty: number;
  evidencePenalty: number;
  survivalDays: number;
  survivalBonus: number;
  curated: boolean;
  curatedBonus: number;
  formula: StabilityFormula;
  affected: string[];
  evidence: StabilityEvidence[];
  notes?: string;
}

export const DEFAULT_STABILITY_SCORE_SETTINGS: StabilityScoreSettings = {
  baseScore: 80,
  survivalBonus: {
    pointsPerDay: 3,
    maxPoints: 15,
  },
  curatedBonus: {
    points: 2,
  },
};

const SCORE_BLOCK_RE = /<!--\s*isitstable:v1\s*([\s\S]*?)\s*-->/m;

function replacementCase(source: string, replacement: string): string {
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  if (source[0] === source[0].toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

export function sanitizePublicText(text: string): string {
  // Legacy upstream terminology: the public site should say app, never the old C-word.
  return text.replace(/client/gi, (match) => replacementCase(match, "app"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redirectGithubIssueUrl(repo: string, number: number): string {
  return `https://redirect.github.com/${repo}/issues/${number}`;
}

function safeIssueLabel(repo: string, number: number): string {
  // Avoid owner/repo#123 in generated data because GitHub auto-links that syntax
  // when it appears in issues/comments, creating noisy upstream backlinks.
  return `${repo} issue ${number}`;
}

function parseIssueRef(raw: string): { repo: string; number: number; url: string; issue: string } | null {
  const shorthand = raw.match(/^([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)#(\d+)$/);
  const redirectUrl = raw.match(/^https:\/\/redirect\.github\.com\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)\/issues\/(\d+)$/);
  const directUrl = raw.match(/^https:\/\/github\.com\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)\/issues\/(\d+)$/);
  const match = shorthand ?? redirectUrl ?? directUrl;
  if (!match) return null;
  const repo = match[1];
  const number = Number(match[2]);
  return {
    repo,
    number,
    url: redirectGithubIssueUrl(repo, number),
    issue: safeIssueLabel(repo, number),
  };
}

export function computeVotePenalty(thumbsUp: number, thumbsDown: number): number {
  return Math.max(0, thumbsDown - thumbsUp) * 2;
}

export function computeSurvivalDays(createdAt: string, nextCreatedAt?: string, now = new Date()): number {
  const start = new Date(createdAt).getTime();
  const end = nextCreatedAt ? new Date(nextCreatedAt).getTime() : now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

export function computeFormula(input: {
  settings?: StabilityScoreSettings;
  evidencePenalty: number;
  votePenalty: number;
  survivalDays?: number;
  curated?: boolean;
}): StabilityFormula {
  const settings = input.settings ?? DEFAULT_STABILITY_SCORE_SETTINGS;
  const survivalDays = input.survivalDays ?? 0;
  const survivalBonus = Math.min(settings.survivalBonus.maxPoints, survivalDays * settings.survivalBonus.pointsPerDay);
  const survivalCreditedDays = settings.survivalBonus.pointsPerDay > 0
    ? Math.floor(survivalBonus / settings.survivalBonus.pointsPerDay)
    : 0;
  const curatedBonus = input.curated ? settings.curatedBonus.points : 0;
  const totalPenalty = input.evidencePenalty + input.votePenalty;
  const positiveScore = settings.baseScore - totalPenalty + survivalBonus + curatedBonus;
  const score = positiveScore > 0 ? positiveScore : -totalPenalty;
  return {
    baseScore: settings.baseScore,
    evidencePenalty: input.evidencePenalty,
    votePenalty: input.votePenalty,
    survivalDays,
    survivalPointsPerDay: settings.survivalBonus.pointsPerDay,
    survivalCreditedDays,
    survivalBonus,
    curatedBonus,
    score,
  };
}

export function withFormula(score: StabilityScore, formula: StabilityFormula): StabilityScore {
  return {
    ...score,
    baseScore: formula.baseScore,
    score: formula.score,
    votePenalty: formula.votePenalty,
    evidencePenalty: formula.evidencePenalty,
    survivalDays: formula.survivalDays,
    survivalBonus: formula.survivalBonus,
    curatedBonus: formula.curatedBonus,
    formula,
  };
}

function normalizeStabilityScore(raw: unknown, thumbsUp: number, thumbsDown: number, fallbackVerdict: StabilityVerdict): StabilityScore | null {
  if (!isRecord(raw)) return null;
  const evidenceRaw = Array.isArray(raw.evidence) ? raw.evidence : [];
  const evidence: StabilityEvidence[] = evidenceRaw.flatMap((item): StabilityEvidence[] => {
    if (!isRecord(item) || typeof item.issue !== "string") return [];
    const ref = parseIssueRef(item.issue);
    if (!ref) return [];
    const penalty = Math.abs(Number(item.penalty ?? 0));
    const severity = Math.max(1, Math.min(5, Number(item.severity ?? Math.min(5, Math.max(1, penalty))))) as 1 | 2 | 3 | 4 | 5;
    return [{
      ...ref,
      title: typeof item.title === "string" ? sanitizePublicText(item.title) : undefined,
      area: typeof item.area === "string" ? sanitizePublicText(item.area) : "unknown",
      type: typeof item.type === "string" ? item.type as StabilityEvidence["type"] : "other",
      severity,
      penalty,
      reason: typeof item.reason === "string" ? sanitizePublicText(item.reason) : "Stability risk",
    }];
  });

  const votePenalty = computeVotePenalty(thumbsUp, thumbsDown);
  const evidencePenalty = evidence.reduce((sum, item) => sum + item.penalty, 0);
  const curated = raw.curated === true;
  const formula = computeFormula({ evidencePenalty, votePenalty, curated });
  const affected = Array.isArray(raw.affected)
    ? raw.affected.filter((item): item is string => typeof item === "string").map(sanitizePublicText)
    : Array.from(new Set(evidence.map((item) => item.area).filter(Boolean)));

  // Score-only mode: ignore any legacy verdict embedded in historical score blocks.
  const verdict = fallbackVerdict;

  return {
    schemaVersion: "isitstable:v1",
    baseScore: formula.baseScore,
    score: formula.score,
    verdict,
    votePenalty,
    evidencePenalty,
    survivalDays: formula.survivalDays,
    survivalBonus: formula.survivalBonus,
    curated,
    curatedBonus: formula.curatedBonus,
    formula,
    affected,
    evidence,
    notes: typeof raw.notes === "string" ? sanitizePublicText(raw.notes) : undefined,
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
  const formula = computeFormula({ evidencePenalty: 0, votePenalty });
  return {
    schemaVersion: "isitstable:v1",
    baseScore: formula.baseScore,
    score: formula.score,
    verdict,
    votePenalty,
    evidencePenalty: 0,
    survivalDays: formula.survivalDays,
    survivalBonus: formula.survivalBonus,
    curated: false,
    curatedBonus: formula.curatedBonus,
    formula,
    affected: [],
    evidence: [],
  };
}
