import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const REPO_OWNER = "exisz";
const REPO_NAME = "IsItStable";
const GITHUB_API = "https://api.github.com";
import { fileURLToPath } from "url";
const __dirname = typeof import.meta.dirname === "string" ? import.meta.dirname : join(fileURLToPath(import.meta.url), "..");
const DATA_DIR = join(__dirname, "..", "data");

const TITLE_RE = /^\[v([^\]]+)\]\s+(.+)$/;
const VERDICT_RE = /^## Verdict:\s*(YES|NO)\s*/im;
const EVIDENCE_RE = /^## Evidence\s*\n([\s\S]*?)(?=\n## |\n*$)/im;
const ISSUE_LINK_RE = /([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)#(\d+)/g;

interface VersionIssue {
  issueNumber: number;
  issueUrl: string;
  version: string;
  packageName: string;
  packageSlug: string;
  verdict: "yes" | "no" | "pending";
  verdictComment: string;
  evidenceSummary: string;
  referencedIssues: { repo: string; number: number; url: string }[];
  thumbsUp: number;
  thumbsDown: number;
  createdAt: string;
  stats: { npmDownloads?: string; githubIssuesCount?: string };
}

interface PackageSummary {
  name: string;
  slug: string;
  displayName: string;
  latestVersion?: VersionIssue;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseIssueBody(body: string | null) {
  if (!body) return { verdict: "pending" as const, verdictComment: "", evidenceSummary: "", referencedIssues: [] as { repo: string; number: number; url: string }[], stats: {} as { npmDownloads?: string; githubIssuesCount?: string } };

  const verdictMatch = body.match(VERDICT_RE);
  const verdict = verdictMatch ? (verdictMatch[1].toUpperCase() === "YES" ? "yes" : "no") as "yes" | "no" : "pending" as const;

  const lines = body.split("\n");
  const verdictIdx = lines.findIndex((l) => VERDICT_RE.test(l));
  let verdictComment = "";
  if (verdictIdx >= 0) {
    for (let i = verdictIdx + 1; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed && !trimmed.startsWith("##")) { verdictComment = trimmed; break; }
    }
  }

  const evidenceMatch = body.match(EVIDENCE_RE);
  const evidenceSummary = evidenceMatch ? evidenceMatch[1].trim() : "";

  const referencedIssues: { repo: string; number: number; url: string }[] = [];
  let m: RegExpExecArray | null;
  const linkRe = new RegExp(ISSUE_LINK_RE.source, "g");
  while ((m = linkRe.exec(body))) {
    referencedIssues.push({ repo: m[1], number: parseInt(m[2]), url: `https://github.com/${m[1]}/issues/${m[2]}` });
  }

  const stats: { npmDownloads?: string; githubIssuesCount?: string } = {};
  const dlMatch = body.match(/npm downloads:\s*([^\n]+)/i);
  if (dlMatch) stats.npmDownloads = dlMatch[1].trim();
  const ghMatch = body.match(/GitHub issues mentioning this version:\s*([^\n]+)/i);
  if (ghMatch) stats.githubIssuesCount = ghMatch[1].trim();

  return { verdict, verdictComment, evidenceSummary, referencedIssues, stats };
}

async function ghFetch(path: string) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required");
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "IsItStable-Sync/1.0",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText} for ${path}`);
  return res.json();
}

async function fetchAllVersionIssues(): Promise<VersionIssue[]> {
  const issues: VersionIssue[] = [];
  let page = 1;

  while (true) {
    const data = await ghFetch(
      `/repos/${REPO_OWNER}/${REPO_NAME}/issues?state=all&creator=${REPO_OWNER}&per_page=100&page=${page}&sort=created&direction=desc`
    );
    if (!Array.isArray(data) || data.length === 0) break;

    for (const issue of data) {
      if (issue.pull_request) continue;
      const titleMatch = issue.title?.match(TITLE_RE);
      if (!titleMatch) continue;

      const version = titleMatch[1];
      const packageName = titleMatch[2].trim();
      const parsed = parseIssueBody(issue.body);
      const thumbsUp = issue.reactions?.["+1"] ?? 0;
      const thumbsDown = issue.reactions?.["-1"] ?? 0;

      issues.push({
        issueNumber: issue.number,
        issueUrl: issue.html_url,
        version,
        packageName,
        packageSlug: slugify(packageName),
        ...parsed,
        thumbsUp,
        thumbsDown,
        createdAt: issue.created_at,
      });
    }

    if (data.length < 100) break;
    page++;
  }

  return issues;
}

async function main() {
  console.log("🔄 Syncing version data from GitHub...");

  const versions = await fetchAllVersionIssues();
  console.log(`📦 Found ${versions.length} version issues`);

  // Build packages summary
  const byPkg = new Map<string, VersionIssue[]>();
  for (const v of versions) {
    if (!byPkg.has(v.packageSlug)) byPkg.set(v.packageSlug, []);
    byPkg.get(v.packageSlug)!.push(v);
  }

  const packages: PackageSummary[] = Array.from(byPkg.entries()).map(([slug, vers]) => ({
    name: slug,
    slug,
    displayName: vers[0].packageName,
    latestVersion: vers[0],
  }));

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  // Compare with existing data
  const versionsPath = join(DATA_DIR, "versions.json");
  const packagesPath = join(DATA_DIR, "packages.json");

  let oldVersionCount = 0;
  try {
    const old = JSON.parse(readFileSync(versionsPath, "utf-8"));
    oldVersionCount = old.length;
  } catch {}

  writeFileSync(versionsPath, JSON.stringify(versions, null, 2) + "\n");
  writeFileSync(packagesPath, JSON.stringify(packages, null, 2) + "\n");

  console.log(`✅ Wrote ${versions.length} versions (was ${oldVersionCount}) and ${packages.length} packages`);
  if (versions.length !== oldVersionCount) {
    console.log(`📝 Change detected: ${versions.length - oldVersionCount} new version(s)`);
  }

  for (const pkg of packages) {
    console.log(`  📦 ${pkg.displayName}: ${byPkg.get(pkg.slug)!.length} version(s)`);
  }
}

main().catch((e) => {
  console.error("❌ Sync failed:", e.message);
  process.exit(1);
});
