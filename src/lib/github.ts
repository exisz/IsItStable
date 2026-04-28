const REPO_OWNER = "exisz";
const REPO_NAME = "IsItStable";
const GITHUB_API = "https://api.github.com";

// Title format: [v2026.4.23] OpenClaw
const TITLE_RE = /^\[v([^\]]+)\]\s+(.+)$/;

// Body parsing
const VERDICT_RE = /^## Verdict:\s*(YES|NO)\s*/im;
const EVIDENCE_RE = /^## Evidence\s*\n([\s\S]*?)(?=\n## |\n*$)/im;
const ISSUE_LINK_RE = /([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)#(\d+)/g;

export interface VersionIssue {
  issueNumber: number;
  issueUrl: string;
  version: string;
  packageName: string;
  packageSlug: string;
  verdict: "yes" | "no" | "pending";
  verdictComment: string;
  evidenceSummary: string;
  referencedIssues: { repo: string; number: number; title?: string; url: string }[];
  thumbsUp: number;
  thumbsDown: number;
  createdAt: string;
  stats: { npmDownloads?: string; githubIssuesCount?: string };
}

export interface PackageSummary {
  name: string;
  slug: string;
  displayName: string;
  latestVersion?: VersionIssue;
}

function parseIssueBody(body: string | null): {
  verdict: "yes" | "no" | "pending";
  verdictComment: string;
  evidenceSummary: string;
  referencedIssues: { repo: string; number: number; url: string }[];
  stats: { npmDownloads?: string; githubIssuesCount?: string };
} {
  if (!body) return { verdict: "pending", verdictComment: "", evidenceSummary: "", referencedIssues: [], stats: {} };

  const verdictMatch = body.match(VERDICT_RE);
  const verdict = verdictMatch ? (verdictMatch[1].toUpperCase() === "YES" ? "yes" : "no") as "yes" | "no" : "pending";

  // Comment = first non-header line after verdict line
  const lines = body.split("\n");
  const verdictIdx = lines.findIndex((l) => VERDICT_RE.test(l));
  let verdictComment = "";
  if (verdictIdx >= 0) {
    for (let i = verdictIdx + 1; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed && !trimmed.startsWith("##")) { verdictComment = trimmed; break; }
    }
  }

  // Evidence
  const evidenceMatch = body.match(EVIDENCE_RE);
  const evidenceSummary = evidenceMatch ? evidenceMatch[1].trim() : "";

  // Referenced issues
  const referencedIssues: { repo: string; number: number; url: string }[] = [];
  let m: RegExpExecArray | null;
  const linkRe = new RegExp(ISSUE_LINK_RE.source, "g");
  while ((m = linkRe.exec(body))) {
    referencedIssues.push({
      repo: m[1],
      number: parseInt(m[2]),
      url: `https://github.com/${m[1]}/issues/${m[2]}`,
    });
  }

  // Stats
  const stats: { npmDownloads?: string; githubIssuesCount?: string } = {};
  const dlMatch = body.match(/npm downloads:\s*([^\n]+)/i);
  if (dlMatch) stats.npmDownloads = dlMatch[1].trim();
  const ghMatch = body.match(/GitHub issues mentioning this version:\s*([^\n]+)/i);
  if (ghMatch) stats.githubIssuesCount = ghMatch[1].trim();

  return { verdict, verdictComment, evidenceSummary, referencedIssues, stats };
}

function parseReactions(reactions: Record<string, number>): { thumbsUp: number; thumbsDown: number } {
  return {
    thumbsUp: reactions["+1"] ?? 0,
    thumbsDown: reactions["-1"] ?? 0,
  };
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function ghFetch(path: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "IsItStable/1.0",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${GITHUB_API}${path}`, { headers, next: { revalidate: 120 } });
}

export async function fetchAllVersionIssues(): Promise<VersionIssue[]> {
  const issues: VersionIssue[] = [];
  let page = 1;

  while (true) {
    const res = await ghFetch(
      `/repos/${REPO_OWNER}/${REPO_NAME}/issues?state=all&creator=${REPO_OWNER}&per_page=100&page=${page}&sort=created&direction=desc`
    );
    if (!res.ok) break;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    for (const issue of data) {
      if (issue.pull_request) continue;
      const titleMatch = issue.title?.match(TITLE_RE);
      if (!titleMatch) continue;

      const version = titleMatch[1];
      const packageName = titleMatch[2].trim();
      const parsed = parseIssueBody(issue.body);
      const reactions = parseReactions(issue.reactions ?? {});

      issues.push({
        issueNumber: issue.number,
        issueUrl: issue.html_url,
        version,
        packageName,
        packageSlug: slugify(packageName),
        ...parsed,
        ...reactions,
        createdAt: issue.created_at,
      });
    }

    if (data.length < 100) break;
    page++;
  }

  return issues;
}

export async function getPackages(): Promise<PackageSummary[]> {
  const issues = await fetchAllVersionIssues();
  const byPkg = new Map<string, VersionIssue[]>();

  for (const issue of issues) {
    const slug = issue.packageSlug;
    if (!byPkg.has(slug)) byPkg.set(slug, []);
    byPkg.get(slug)!.push(issue);
  }

  return Array.from(byPkg.entries()).map(([slug, versions]) => ({
    name: slug,
    slug,
    displayName: versions[0].packageName,
    latestVersion: versions[0],
  }));
}

export async function getPackageVersions(packageSlug: string): Promise<VersionIssue[]> {
  const issues = await fetchAllVersionIssues();
  return issues.filter((i) => i.packageSlug === packageSlug);
}

export async function getVersionBySlug(packageSlug: string, version: string): Promise<VersionIssue | undefined> {
  const issues = await fetchAllVersionIssues();
  return issues.find((i) => i.packageSlug === packageSlug && i.version === version);
}

export async function getLatestStable(packageSlug: string): Promise<VersionIssue | undefined> {
  const versions = await getPackageVersions(packageSlug);
  return versions.find((v) => v.verdict === "yes");
}

export async function getPackageSummary(packageSlug: string): Promise<{ displayName: string; versions: VersionIssue[] } | null> {
  const versions = await getPackageVersions(packageSlug);
  if (versions.length === 0) return null;
  return { displayName: versions[0].packageName, versions };
}
