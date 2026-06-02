#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_OWNER = 'exisz';
const REPO_NAME = 'IsItStable';
const API = 'https://api.github.com';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CACHE = join(ROOT, 'data', 'version-title-cache.json');
const SOURCES = join(ROOT, 'data', 'package-sources.json');
const TITLE_RE = /^\[v([^\]]+)\]\s*\[([^\]]+)\]/;

function token() {
  const t = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!t) throw new Error('GITHUB_TOKEN or GH_TOKEN is required');
  return t;
}

async function gh(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'IsItStable-VersionChecker/1.0',
      Authorization: `Bearer ${token()}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status} ${res.statusText} for ${path}: ${body}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function graphql(query, variables) {
  const res = await fetch(`${API}/graphql`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'IsItStable-VersionChecker/1.0',
      Authorization: `Bearer ${token()}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}: ${res.statusText}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
  return json.data;
}

function parseVersion(v) {
  return String(v).split(/[.-]/).map((part) => {
    const n = Number(part);
    return Number.isFinite(n) ? n : 0;
  });
}

function gteVersion(version, minimum) {
  const a = parseVersion(version);
  const b = parseVersion(minimum);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return true;
}

function stableVersion(v) {
  return !/(alpha|beta|rc|canary|next|dev)/i.test(v);
}

async function npmVersions(pkg) {
  const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}`);
  if (!res.ok) throw new Error(`npm registry ${res.status} for ${pkg}`);
  const data = await res.json();
  return Object.keys(data.versions ?? {}).filter(stableVersion);
}

async function githubReleaseVersions(source) {
  if (!source.githubReleases || !source.upstreamRepo) return [];
  const releases = await gh(`/repos/${source.upstreamRepo}/releases?per_page=100`);
  const pattern = source.githubReleaseVersionPattern
    ? new RegExp(source.githubReleaseVersionPattern)
    : /v([0-9]+\.[0-9]+\.[0-9]+)/;
  const versions = [];
  for (const release of releases) {
    const text = `${release.name ?? ""} ${release.tag_name ?? ""}`;
    const match = text.match(pattern);
    if (match?.[1] && stableVersion(match[1])) versions.push(match[1]);
  }
  return versions;
}

async function fetchIssueTitleCache() {
  const query = `
    query($owner:String!, $repo:String!, $after:String) {
      repository(owner:$owner, name:$repo) {
        issues(first:100, after:$after, states:[OPEN, CLOSED], orderBy:{field:CREATED_AT, direction:DESC}) {
          pageInfo { hasNextPage endCursor }
          nodes { number title state url createdAt updatedAt labels(first:50) { nodes { name } } }
        }
      }
    }
  `;
  const issues = [];
  let after = null;
  do {
    const data = await graphql(query, { owner: REPO_OWNER, repo: REPO_NAME, after });
    const page = data.repository.issues;
    issues.push(...page.nodes);
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);

  const versions = [];
  const seen = new Map();
  const duplicates = new Map();
  for (const issue of issues) {
    const m = issue.title?.match(TITLE_RE);
    if (!m) continue;
    const labels = (issue.labels?.nodes ?? []).map((l) => l.name);
    const pkgLabel = labels.find((l) => l.startsWith('pkg:')) ?? null;
    const packageSlug = pkgLabel ? pkgLabel.slice(4) : m[2].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const entry = {
      version: m[1],
      packageName: m[2],
      packageSlug,
      labels,
      issueNumber: issue.number,
      title: issue.title,
      state: issue.state.toLowerCase(),
      url: issue.url,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    };
    versions.push(entry);
    const key = `${entry.packageSlug}:${entry.version}`;
    if (seen.has(key)) {
      if (!duplicates.has(key)) duplicates.set(key, [seen.get(key)]);
      duplicates.get(key).push(entry);
    } else {
      seen.set(key, entry);
    }
  }
  versions.sort((a, b) => `${a.packageSlug}:${a.version}`.localeCompare(`${b.packageSlug}:${b.version}`, undefined, { numeric: true }));
  const cache = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    source: 'github-graphql:repository.issues:title-only',
    repo: `${REPO_OWNER}/${REPO_NAME}`,
    versions,
    duplicates: Object.fromEntries([...duplicates.entries()]),
  };
  mkdirSync(dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, `${JSON.stringify(cache, null, 2)}\n`);
  return cache;
}

async function ensureLabel(name, color = '1D76DB', description = '') {
  try {
    await gh(`/repos/${REPO_OWNER}/${REPO_NAME}/labels/${encodeURIComponent(name)}`);
  } catch (e) {
    if (!String(e.message).includes('404')) throw e;
    await gh(`/repos/${REPO_OWNER}/${REPO_NAME}/labels`, {
      method: 'POST',
      body: JSON.stringify({ name, color, description }),
    });
    console.log(`Created label ${name}`);
  }
}

function issueBody(source) {
  const sources = [`npm package \`${source.npmPackage}\``];
  if (source.githubReleases && source.upstreamRepo) sources.push(`GitHub releases in \`${source.upstreamRepo}\``);
  return `## Stability Score: pending ⏳
Awaiting evidence analysis. This version was auto-detected from ${sources.join(" and ")}.

## Evidence
_No analysis yet. The operator will review upstream GitHub issues in \`${source.upstreamRepo}\` and update the factual score._

## Stats
- npm package: \`${source.npmPackage}\`
- upstream repo: \`${source.upstreamRepo}\`
- npm downloads: pending
- GitHub issues mentioning this version: pending

---
_Auto-created by IsItStable version checker._`;
}

async function createIssue(source, version) {
  const title = `[v${version}] [${source.titlePackage ?? source.displayName}] Is it stable?`;
  const labels = source.labels ?? ['version', `pkg:${source.slug}`];
  for (const label of labels) {
    await ensureLabel(label, label === 'version' ? '0075ca' : '1D76DB', label === 'version' ? 'Version stability verdict' : `${source.displayName} package`);
  }
  const issue = await gh(`/repos/${REPO_OWNER}/${REPO_NAME}/issues`, {
    method: 'POST',
    body: JSON.stringify({ title, labels, body: issueBody(source) }),
  });
  console.log(`Created ${source.slug} v${version}: #${issue.number}`);
  return issue;
}

async function main() {
  const sources = JSON.parse(readFileSync(SOURCES, 'utf8'));
  const cache = await fetchIssueTitleCache();
  let created = 0;

  for (const source of sources) {
    const versions = [...new Set([
      ...(await npmVersions(source.npmPackage)),
      ...(await githubReleaseVersions(source)),
    ])]
      .filter((v) => !source.minVersion || gteVersion(v, source.minVersion))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const existing = new Set(cache.versions.filter((v) => v.packageSlug === source.slug).map((v) => v.version));
    const missing = versions.filter((v) => !existing.has(v));
    console.log(`${source.slug}: ${versions.length} npm version(s), ${existing.size} tracked, ${missing.length} missing`);
    for (const version of missing) {
      await createIssue(source, version);
      created += 1;
    }
  }

  if (created > 0) await fetchIssueTitleCache();
  console.log(`Created ${created} issue(s)`);
  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(process.env.GITHUB_OUTPUT, `created=${created}\n`, { flag: 'a' });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
