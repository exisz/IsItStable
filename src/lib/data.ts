import { readFileSync } from "fs";
import { join } from "path";
import { computeFormula, computeSurvivalDays, DEFAULT_STABILITY_SCORE_SETTINGS, fallbackStabilityScore, sanitizePublicText, withFormula, type StabilityScore, type StabilityScoreSettings } from "./stability";

export interface VersionIssue {
  issueNumber: number;
  issueUrl: string;
  version: string;
  packageName: string;
  packageSlug: string;
  verdict: "yes" | "no" | "pending";
  verdictComment: string;
  referencedIssues: { repo: string; number: number; url: string; title?: string }[];
  stabilityScore: StabilityScore;
  thumbsUp: number;
  thumbsDown: number;
  createdAt: string;
}

export interface PackageSummary {
  name: string;
  slug: string;
  displayName: string;
  latestVersion?: VersionIssue;
}

const DATA_DIR = join(process.cwd(), "data");

let _versions: VersionIssue[] | null = null;
let _packages: PackageSummary[] | null = null;
let _settings: StabilityScoreSettings | null = null;

function loadScoreSettings(): StabilityScoreSettings {
  if (!_settings) {
    try {
      const raw = JSON.parse(readFileSync(join(DATA_DIR, "settings.json"), "utf-8"));
      _settings = {
        baseScore: Number(raw?.stabilityScore?.baseScore ?? DEFAULT_STABILITY_SCORE_SETTINGS.baseScore),
        survivalBonus: {
          pointsPerDay: Number(raw?.stabilityScore?.survivalBonus?.pointsPerDay ?? DEFAULT_STABILITY_SCORE_SETTINGS.survivalBonus.pointsPerDay),
          maxPoints: Number(raw?.stabilityScore?.survivalBonus?.maxPoints ?? DEFAULT_STABILITY_SCORE_SETTINGS.survivalBonus.maxPoints),
        },
        curatedBonus: {
          points: Number(raw?.stabilityScore?.curatedBonus?.points ?? DEFAULT_STABILITY_SCORE_SETTINGS.curatedBonus.points),
        },
      };
    } catch {
      _settings = DEFAULT_STABILITY_SCORE_SETTINGS;
    }
  }
  return _settings;
}

function evidenceCount(v: VersionIssue): number {
  return v.stabilityScore?.evidence?.length ?? 0;
}

function canonicalVersionIssues(versions: VersionIssue[]): VersionIssue[] {
  const byKey = new Map<string, VersionIssue[]>();
  for (const v of versions) {
    const key = `${v.packageSlug}:${v.version}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(v);
  }

  const canonical: VersionIssue[] = [];
  for (const candidates of byKey.values()) {
    const sorted = [...candidates].sort((a, b) => {
      const evidenceDiff = evidenceCount(b) - evidenceCount(a);
      if (evidenceDiff !== 0) return evidenceDiff;
      const scoreBlockDiff = Number(Boolean(b.stabilityScore?.schemaVersion)) - Number(Boolean(a.stabilityScore?.schemaVersion));
      if (scoreBlockDiff !== 0) return scoreBlockDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    canonical.push(sorted[0]);
  }
  return canonical;
}

function applyScoreFormula(versions: VersionIssue[]): VersionIssue[] {
  const settings = loadScoreSettings();
  const byPkg = new Map<string, VersionIssue[]>();
  for (const v of versions) {
    if (!byPkg.has(v.packageSlug)) byPkg.set(v.packageSlug, []);
    byPkg.get(v.packageSlug)!.push(v);
  }

  for (const pkgVersions of byPkg.values()) {
    const chronological = [...pkgVersions].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    for (let i = 0; i < chronological.length; i++) {
      const current = chronological[i];
      const next = chronological[i + 1];
      const formula = computeFormula({
        settings,
        evidencePenalty: current.stabilityScore.evidencePenalty,
        votePenalty: current.stabilityScore.votePenalty,
        survivalDays: computeSurvivalDays(current.createdAt, next?.createdAt),
        curated: current.stabilityScore.curated === true,
      });
      current.stabilityScore = withFormula(current.stabilityScore, formula);
    }
  }

  return versions;
}

function loadVersions(): VersionIssue[] {
  if (!_versions) {
    const raw = JSON.parse(readFileSync(join(DATA_DIR, "versions.json"), "utf-8")) as VersionIssue[];
    _versions = applyScoreFormula(canonicalVersionIssues(raw.map((v) => ({
      ...v,
      packageName: sanitizePublicText(v.packageName),
      verdictComment: sanitizePublicText(v.verdictComment ?? ""),
      referencedIssues: (v.referencedIssues ?? []).map((issue) => ({
        ...issue,
        title: issue.title ? sanitizePublicText(issue.title) : undefined,
      })),
      stabilityScore: v.stabilityScore ?? fallbackStabilityScore(v.thumbsUp ?? 0, v.thumbsDown ?? 0, "pending"),
    }))));
  }
  return _versions!;
}

function loadPackages(): PackageSummary[] {
  if (!_packages) {
    const latestBySlug = new Map<string, VersionIssue>();
    for (const v of loadVersions()) {
      if (!latestBySlug.has(v.packageSlug)) latestBySlug.set(v.packageSlug, v);
    }
    const raw = JSON.parse(readFileSync(join(DATA_DIR, "packages.json"), "utf-8")) as PackageSummary[];
    _packages = raw.map((pkg) => ({
      ...pkg,
      displayName: sanitizePublicText(pkg.displayName),
      latestVersion: latestBySlug.get(pkg.slug) ?? pkg.latestVersion,
    }));
  }
  return _packages!;
}

export async function fetchAllVersionIssues(): Promise<VersionIssue[]> {
  return loadVersions();
}

export async function getPackages(): Promise<PackageSummary[]> {
  return loadPackages();
}

export async function getPackageVersions(packageSlug: string): Promise<VersionIssue[]> {
  return loadVersions().filter((i) => i.packageSlug === packageSlug);
}

export async function getVersionBySlug(packageSlug: string, version: string): Promise<VersionIssue | undefined> {
  return loadVersions().find((i) => i.packageSlug === packageSlug && i.version === version);
}

export async function getLatestStable(packageSlug: string): Promise<VersionIssue | undefined> {
  return getBestVersions(packageSlug, 1).then((versions) => versions[0]);
}

export async function getBestVersions(packageSlug: string, limit = 3): Promise<VersionIssue[]> {
  return loadVersions()
    .filter((i) => i.packageSlug === packageSlug)
    .sort((a, b) => {
      const scoreDiff = b.stabilityScore.score - a.stabilityScore.score;
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, limit);
}

export async function getPackageSummary(packageSlug: string): Promise<{ displayName: string; versions: VersionIssue[] } | null> {
  const versions = loadVersions().filter((i) => i.packageSlug === packageSlug);
  if (versions.length === 0) return null;
  return { displayName: versions[0].packageName, versions };
}
