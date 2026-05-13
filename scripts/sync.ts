import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { computeFormula, computeSurvivalDays, DEFAULT_STABILITY_SCORE_SETTINGS, fallbackStabilityScore, parseStabilityBlock, withFormula, type StabilityScore, type StabilityScoreSettings } from "../src/lib/stability";

const REPO_OWNER = "exisz";
const REPO_NAME = "IsItStable";
const GITHUB_API = "https://api.github.com";
const __dirname = typeof import.meta.dirname === "string" ? import.meta.dirname : join(fileURLToPath(import.meta.url), "..");
const DATA_DIR = join(__dirname, "..", "data");
const SETTINGS_PATH = join(DATA_DIR, "settings.json");
const FIXED_SPONSORS = [
  {
    name: "Exis",
    url: "https://github.com/exisz",
    avatarUrl: "https://avatars.githubusercontent.com/u/38595828?v=4",
    tier: "Maintainer",
  },
];

// Title format: [v2026.4.26] [OpenClaw] Is it stable?
const TITLE_RE = /^\[v([^\]]+)\]\s*\[([^\]]+)\]/;
const ISSUE_LINK_RE = /([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)#(\d+)/g;

interface VersionIssue {
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

interface PackageSummary {
  name: string;
  slug: string;
  displayName: string;
  latestVersion?: VersionIssue;
}

function loadScoreSettings(): StabilityScoreSettings {
  try {
    const raw = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
    return {
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
    return DEFAULT_STABILITY_SCORE_SETTINGS;
  }
}

function applyScoreFormula(versions: VersionIssue[], settings: StabilityScoreSettings) {
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
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Extract verdict from labels. Labels: verdict:yes, verdict:no, verdict:pending */
function getVerdictFromLabels(labels: string[]): "yes" | "no" | "pending" {
  for (const l of labels) {
    if (l === "verdict:yes") return "yes";
    if (l === "verdict:no") return "no";
    if (l === "verdict:pending") return "pending";
  }
  return "pending";
}

/** Extract package name from labels. Label: pkg:openclaw */
function getPackageFromLabels(labels: string[]): string | null {
  for (const l of labels) {
    if (l.startsWith("pkg:")) return l.slice(4);
  }
  return null;
}

/** Extract first blockquote line as verdict comment, referenced issues, and score metadata from body */
function parseBody(body: string | null, thumbsUp: number, thumbsDown: number, verdict: "yes" | "no" | "pending") {
  const result = {
    verdictComment: "",
    referencedIssues: [] as { repo: string; number: number; url: string; title?: string }[],
    stabilityScore: fallbackStabilityScore(thumbsUp, thumbsDown, verdict),
  };
  if (!body) return result;

  // First blockquote line = verdict comment
  const bqMatch = body.match(/^>\s*(.+)/m);
  if (bqMatch) result.verdictComment = bqMatch[1].trim();

  // Referenced issues
  let m: RegExpExecArray | null;
  const re = new RegExp(ISSUE_LINK_RE.source, "g");
  while ((m = re.exec(body))) {
    result.referencedIssues.push({ repo: m[1], number: parseInt(m[2]), url: `https://github.com/${m[1]}/issues/${m[2]}` });
  }


  const stabilityScore = parseStabilityBlock(body, thumbsUp, thumbsDown, verdict);
  if (stabilityScore) result.stabilityScore = stabilityScore;

  return result;
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

async function fetchNpmPublishTimes(packageName: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${packageName}`);
    if (!res.ok) return {};
    const data = await res.json() as { time?: Record<string, string> };
    return data.time ?? {};
  } catch {
    return {};
  }
}

async function fetchAllVersionIssues(): Promise<VersionIssue[]> {
  const issues: VersionIssue[] = [];
  let page = 1;

  while (true) {
    const data = await ghFetch(
      `/repos/${REPO_OWNER}/${REPO_NAME}/issues?state=open&labels=version&per_page=100&page=${page}&sort=created&direction=desc`
    );
    if (!Array.isArray(data) || data.length === 0) break;

    for (const issue of data) {
      if (issue.pull_request) continue;

      const labels: string[] = (issue.labels ?? []).map((l: any) => typeof l === "string" ? l : l.name);
      if (!labels.includes("version")) continue;

      // Version from title
      const titleMatch = issue.title?.match(TITLE_RE);
      if (!titleMatch) continue;
      const version = titleMatch[1];

      // Package from label (pkg:xxx), fallback to title
      const packageName = getPackageFromLabels(labels) ?? titleMatch[2].trim();

      // Verdict from label
      const verdict = getVerdictFromLabels(labels);

      const thumbsUp = issue.reactions?.["+1"] ?? 0;
      const thumbsDown = issue.reactions?.["-1"] ?? 0;

      // Comment + refs + stability score from body
      const { verdictComment, referencedIssues, stabilityScore } = parseBody(issue.body, thumbsUp, thumbsDown, verdict);
      stabilityScore.curated = labels.includes("curated:yes");

      issues.push({
        issueNumber: issue.number,
        issueUrl: issue.html_url,
        version,
        packageName,
        packageSlug: slugify(packageName),
        verdict,
        verdictComment,
        referencedIssues,
        stabilityScore,
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
  const scoreSettings = loadScoreSettings();

  // Override createdAt with real npm publish times
  const npmPackages = new Set(versions.map((v) => v.packageName));
  const allNpmTimes: Record<string, Record<string, string>> = {};
  for (const pkg of npmPackages) {
    allNpmTimes[pkg] = await fetchNpmPublishTimes(pkg);
  }
  for (const v of versions) {
    const npmTime = allNpmTimes[v.packageName]?.[v.version];
    if (npmTime) v.createdAt = npmTime;
  }

  // Fetch titles for referenced issues (batched, graceful fallback)
  const allRefs = new Map<string, { repo: string; number: number }>();
  for (const v of versions) {
    for (const ref of v.referencedIssues) {
      allRefs.set(`${ref.repo}#${ref.number}`, ref);
    }
  }
  const titleCache = new Map<string, string>();
  for (const [key, { repo, number }] of allRefs) {
    try {
      const data = await ghFetch(`/repos/${repo}/issues/${number}`);
      if (data.title) titleCache.set(key, data.title);
    } catch {
      // graceful fallback: no title
    }
  }
  for (const v of versions) {
    for (const ref of v.referencedIssues) {
      const title = titleCache.get(`${ref.repo}#${ref.number}`);
      if (title) (ref as any).title = title;
    }
  }

  applyScoreFormula(versions, scoreSettings);

  // Sort by version number descending (newest first)
  versions.sort((a, b) => {
    const pa = a.version.split(/[.-]/).map(Number);
    const pb = b.version.split(/[.-]/).map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const diff = (pb[i] || 0) - (pa[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  });

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
  for (const pkg of packages) {
    console.log(`  📦 ${pkg.displayName}: ${byPkg.get(pkg.slug)!.length} version(s)`);
  }
}

async function syncSponsors() {
  console.log("🔄 Syncing sponsors from GitHub GraphQL...");
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn("⚠️  GITHUB_TOKEN not set, skipping sponsors sync");
    return;
  }

  const query = `{
    user(login: "exisz") {
      sponsorshipsAsMaintainer(first: 100, includePrivate: false) {
        nodes {
          sponsorEntity {
            ... on User { login name avatarUrl url }
            ... on Organization { login name avatarUrl url }
          }
          tier { name monthlyPriceInDollars }
        }
      }
    }
  }`;

  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "IsItStable-Sync/1.0",
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      console.warn(`⚠️  Sponsors API returned ${res.status}, writing fixed sponsors only`);
      writeFileSync(join(DATA_DIR, "sponsors.json"), JSON.stringify(FIXED_SPONSORS, null, 2) + "\n");
      return;
    }

    const json = await res.json() as any;
    if (json.errors) {
      console.warn("⚠️  Sponsors GraphQL errors:", json.errors[0]?.message);
      writeFileSync(join(DATA_DIR, "sponsors.json"), JSON.stringify(FIXED_SPONSORS, null, 2) + "\n");
      return;
    }

    const nodes = json.data?.user?.sponsorshipsAsMaintainer?.nodes ?? [];
    const dynamicSponsors = nodes
      .filter((n: any) => n.sponsorEntity)
      .map((n: any) => ({
        name: n.sponsorEntity.name || n.sponsorEntity.login,
        url: n.sponsorEntity.url,
        avatarUrl: n.sponsorEntity.avatarUrl,
        tier: n.tier?.name ?? undefined,
        monthlyPriceInDollars: n.tier?.monthlyPriceInDollars ?? undefined,
      }));

    const sponsors = [...FIXED_SPONSORS, ...dynamicSponsors.filter((s: any) => s.url !== "https://github.com/exisz")];

    writeFileSync(join(DATA_DIR, "sponsors.json"), JSON.stringify(sponsors, null, 2) + "\n");
    console.log(`✅ Wrote ${sponsors.length} sponsor(s)`);
  } catch (e: any) {
    console.warn("⚠️  Sponsors sync failed (non-fatal):", e.message);
    writeFileSync(join(DATA_DIR, "sponsors.json"), JSON.stringify(FIXED_SPONSORS, null, 2) + "\n");
  }
}

/** Update the <!-- sponsors --> section in README.md with current sponsors.json */
function updateReadmeSponsors(sponsors: { name: string; url: string; avatarUrl?: string }[]) {
  const readmePath = join(DATA_DIR, "..", "README.md");
  if (!existsSync(readmePath)) return;
  const readme = readFileSync(readmePath, "utf-8");
  const startTag = "<!-- sponsors -->";
  const endTag = "<!-- /sponsors -->";
  const startIdx = readme.indexOf(startTag);
  const endIdx = readme.indexOf(endTag);
  if (startIdx === -1 || endIdx === -1) return;

  let table = "| Sponsors |\n|--------|\n";
  for (const s of sponsors) {
    const avatar = s.avatarUrl ? `<img src=\"${s.avatarUrl}\" width=\"40\" />` : "";
    table += `| [${avatar}](${s.url}) |\n`;
  }
  if (sponsors.length === 0) table += "| *Be the first — [sponsor →](https://github.com/sponsors/exisz)* |\n";

  const updated = readme.slice(0, startIdx + startTag.length) + "\n" + table + readme.slice(endIdx);
  writeFileSync(readmePath, updated);
  console.log(`✅ README sponsors section updated (${sponsors.length} sponsor(s))`);
}

async function run() {
  await main();
  await syncSponsors();
  // Update README with latest sponsors
  try {
    const sponsorsPath = join(DATA_DIR, "sponsors.json");
    if (existsSync(sponsorsPath)) {
      const data = JSON.parse(readFileSync(sponsorsPath, "utf-8"));
      updateReadmeSponsors(data);
    }
  } catch (e: any) {
    console.warn("⚠️  README sponsors update failed (non-fatal):", e.message);
  }
}

run().catch((e) => {
  console.error("❌ Sync failed:", e.message);
  process.exit(1);
});
