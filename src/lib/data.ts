import { readFileSync } from "fs";
import { join } from "path";
import { fallbackStabilityScore, type StabilityScore } from "./stability";

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

function loadVersions(): VersionIssue[] {
  if (!_versions) {
    const raw = JSON.parse(readFileSync(join(DATA_DIR, "versions.json"), "utf-8")) as VersionIssue[];
    _versions = raw.map((v) => ({
      ...v,
      stabilityScore: v.stabilityScore ?? fallbackStabilityScore(v.thumbsUp ?? 0, v.thumbsDown ?? 0, v.verdict),
    }));
  }
  return _versions!;
}

function loadPackages(): PackageSummary[] {
  if (!_packages) {
    const latestBySlug = new Map(loadVersions().map((v) => [v.packageSlug, v]));
    const raw = JSON.parse(readFileSync(join(DATA_DIR, "packages.json"), "utf-8")) as PackageSummary[];
    _packages = raw.map((pkg) => ({
      ...pkg,
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
  return loadVersions().filter((i) => i.packageSlug === packageSlug).find((v) => v.verdict === "yes");
}

export async function getPackageSummary(packageSlug: string): Promise<{ displayName: string; versions: VersionIssue[] } | null> {
  const versions = loadVersions().filter((i) => i.packageSlug === packageSlug);
  if (versions.length === 0) return null;
  return { displayName: versions[0].packageName, versions };
}
