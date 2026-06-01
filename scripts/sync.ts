/* eslint-disable @typescript-eslint/no-explicit-any */
import { writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { computeFormula, computeSurvivalDays, DEFAULT_STABILITY_SCORE_SETTINGS, fallbackStabilityScore, parseStabilityBlock, withFormula, type StabilityScore, type StabilityScoreSettings } from "../src/lib/stability";

const REPO_OWNER = "exisz";
const REPO_NAME = "IsItStable";
const GITHUB_API = "https://api.github.com";
const __dirname = typeof import.meta.dirname === "string" ? import.meta.dirname : join(fileURLToPath(import.meta.url), "..");
const DATA_DIR = join(__dirname, "..", "data");
const SETTINGS_PATH = join(DATA_DIR, "settings.json");
const PACKAGE_SOURCES_PATH = join(DATA_DIR, "package-sources.json");
const PACKAGE_OVERRIDES_DIR = join(DATA_DIR, "packages.d");
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

interface PackageSource {
  slug: string;
  displayName: string;
  npmPackage: string;
  titlePackage?: string;
  upstreamRepo?: string;
}

interface VersionIssueQueryResult {
  repository: {
    issues: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: {
        number: number;
        title: string;
        body: string | null;
        url: string;
        createdAt: string;
        labels: { nodes: { name: string }[] };
        thumbsUp: { totalCount: number };
        thumbsDown: { totalCount: number };
      }[];
    };
  };
}

function loadPackageSources(): Map<string, PackageSource> {
  try {
    const raw = JSON.parse(readFileSync(PACKAGE_SOURCES_PATH, "utf-8")) as PackageSource[];
    return new Map(raw.map((source) => [source.slug, source]));
  } catch {
    return new Map();
  }
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
  for (const [key, candidates] of byKey) {
    const sorted = [...candidates].sort((a, b) => {
      const evidenceDiff = evidenceCount(b) - evidenceCount(a);
      if (evidenceDiff !== 0) return evidenceDiff;
      const scoreBlockDiff = Number(Boolean(b.stabilityScore?.schemaVersion)) - Number(Boolean(a.stabilityScore?.schemaVersion));
      if (scoreBlockDiff !== 0) return scoreBlockDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    const winner = sorted[0];
    if (sorted.length > 1) {
      console.warn(`⚠️  Duplicate ${key}: using #${winner.issueNumber}, ignoring ${sorted.slice(1).map((v) => `#${v.issueNumber}`).join(", ")}`);
    }
    canonical.push(winner);
  }
  return canonical;
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

// Legacy API compatibility only. IsItStable is score-only; do not infer editorial verdicts from labels.
const SCORE_ONLY_LEGACY_VERDICT = "pending" as const;

/** Extract package slug from labels. Label: pkg:openclaw */
function getPackageSlugFromLabels(labels: string[]): string | null {
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
    // Use redirect.github.com so IsItStable's generated evidence links do not
    // create noisy GitHub backlinks on every upstream issue we reference.
    result.referencedIssues.push({ repo: m[1], number: parseInt(m[2]), url: `https://redirect.github.com/${m[1]}/issues/${m[2]}` });
  }


  const stabilityScore = parseStabilityBlock(body, thumbsUp, thumbsDown, verdict);
  if (stabilityScore) result.stabilityScore = stabilityScore;

  return result;
}

function githubToken() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required");
  return token;
}

async function ghFetch(path: string) {
  const token = githubToken();
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

async function ghGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const token = githubToken();
  const res = await fetch(`${GITHUB_API}/graphql`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "IsItStable-Sync/1.0",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}: ${res.statusText}`);
  const json = await res.json() as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(`GitHub GraphQL error: ${json.errors.map((e) => e.message).join("; ")}`);
  if (!json.data) throw new Error("GitHub GraphQL returned no data");
  return json.data;
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
  let after: string | null = null;

  // Do not use the REST issues list for version discovery. We observed REST
  // `/issues` and label-filtered variants omit older open issues (#73/#74) while
  // direct issue reads and GraphQL repository issues returned them correctly.
  const query = `
    query($owner:String!, $repo:String!, $after:String) {
      repository(owner:$owner, name:$repo) {
        issues(first:100, after:$after, states:OPEN, orderBy:{field:CREATED_AT, direction:DESC}) {
          pageInfo { hasNextPage endCursor }
          nodes {
            number
            title
            body
            url
            createdAt
            labels(first:50) { nodes { name } }
            thumbsUp: reactions(first:1, content:THUMBS_UP) { totalCount }
            thumbsDown: reactions(first:1, content:THUMBS_DOWN) { totalCount }
          }
        }
      }
    }
  `;

  while (true) {
    const data: VersionIssueQueryResult = await ghGraphql<VersionIssueQueryResult>(query, { owner: REPO_OWNER, repo: REPO_NAME, after });

    const page = data.repository.issues;
    for (const issue of page.nodes) {
      const labels: string[] = (issue.labels?.nodes ?? []).map((l) => l.name);
      if (!labels.includes("version")) continue;

      // Version from title
      const titleMatch = issue.title?.match(TITLE_RE);
      if (!titleMatch) continue;
      const version = titleMatch[1];

      // Display package comes from title; canonical slug comes from pkg:* label.
      const packageName = titleMatch[2].trim();
      const packageSlug = getPackageSlugFromLabels(labels) ?? slugify(packageName);

      // Score-only mode: verdict labels are legacy and intentionally ignored.
      const verdict = SCORE_ONLY_LEGACY_VERDICT;

      const thumbsUp = issue.thumbsUp?.totalCount ?? 0;
      const thumbsDown = issue.thumbsDown?.totalCount ?? 0;

      // Comment + refs + stability score from body
      const { verdictComment, referencedIssues, stabilityScore } = parseBody(issue.body, thumbsUp, thumbsDown, verdict);
      stabilityScore.curated = labels.includes("curated:yes");

      issues.push({
        issueNumber: issue.number,
        issueUrl: issue.url,
        version,
        packageName,
        packageSlug,
        verdict,
        verdictComment,
        referencedIssues,
        stabilityScore,
        thumbsUp,
        thumbsDown,
        createdAt: issue.createdAt,
      });
    }

    if (!page.pageInfo.hasNextPage) break;
    after = page.pageInfo.endCursor;
  }

  return issues;
}

function loadPackageOverrides(): VersionIssue[] {
  if (!existsSync(PACKAGE_OVERRIDES_DIR)) return [];
  const versions: VersionIssue[] = [];
  for (const file of readdirSync(PACKAGE_OVERRIDES_DIR)) {
    if (!file.endsWith(".json")) continue;
    const raw = JSON.parse(readFileSync(join(PACKAGE_OVERRIDES_DIR, file), "utf-8"));
    for (const version of raw.versions ?? []) versions.push(version as VersionIssue);
  }
  return versions;
}

async function main() {
  console.log("🔄 Syncing version data from GitHub...");

  const versions = [...await fetchAllVersionIssues(), ...loadPackageOverrides()];
  const scoreSettings = loadScoreSettings();

  // Override createdAt with real npm publish times. Display names in issue titles
  // may differ from npm package names, so package-sources.json is canonical.
  const packageSources = loadPackageSources();
  const npmPackageFor = (v: VersionIssue) => packageSources.get(v.packageSlug)?.npmPackage ?? v.packageSlug;
  const npmPackages = new Set(versions.map(npmPackageFor));
  const allNpmTimes: Record<string, Record<string, string>> = {};
  for (const pkg of npmPackages) {
    allNpmTimes[pkg] = await fetchNpmPublishTimes(pkg);
  }
  for (const v of versions) {
    const npmTime = allNpmTimes[npmPackageFor(v)]?.[v.version];
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
  const refEntries = [...allRefs.entries()];
  const titleBatchSize = 20;
  for (let i = 0; i < refEntries.length; i += titleBatchSize) {
    const batch = refEntries.slice(i, i + titleBatchSize);
    await Promise.all(batch.map(async ([key, { repo, number }]) => {
      try {
        const data = await ghFetch(`/repos/${repo}/issues/${number}`);
        if (data.title) titleCache.set(key, data.title);
      } catch {
        // graceful fallback: no title
      }
    }));
  }
  for (const v of versions) {
    for (const ref of v.referencedIssues) {
      const title = titleCache.get(`${ref.repo}#${ref.number}`);
      if (title) (ref as any).title = title;
    }
  }

  const canonicalVersions = canonicalVersionIssues(versions);
  applyScoreFormula(canonicalVersions, scoreSettings);

  // Sort by version number descending (newest first)
  canonicalVersions.sort((a, b) => {
    const pa = a.version.split(/[.-]/).map(Number);
    const pb = b.version.split(/[.-]/).map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const diff = (pb[i] || 0) - (pa[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  });

  console.log(`📦 Found ${canonicalVersions.length} canonical version issues (${versions.length} raw)`);

  // Build packages summary
  const byPkg = new Map<string, VersionIssue[]>();
  for (const v of canonicalVersions) {
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

  writeFileSync(versionsPath, JSON.stringify(canonicalVersions, null, 2) + "\n");
  writeFileSync(packagesPath, JSON.stringify(packages, null, 2) + "\n");

  console.log(`✅ Wrote ${canonicalVersions.length} versions (was ${oldVersionCount}) and ${packages.length} packages`);
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
