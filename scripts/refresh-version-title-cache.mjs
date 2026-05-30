#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_OWNER = 'exisz';
const REPO_NAME = 'IsItStable';
const TITLE_RE = /^\[v([^\]]+)\]\s*\[([^\]]+)\]/;
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'data', 'version-title-cache.json');

function token() {
  const t = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!t) throw new Error('GITHUB_TOKEN or GH_TOKEN is required');
  return t;
}

async function graphql(query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'IsItStable-VersionTitleCache/1.0',
      Authorization: `Bearer ${token()}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}: ${res.statusText}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
  return json.data;
}

async function fetchIssues() {
  const query = `
    query($owner:String!, $repo:String!, $after:String) {
      repository(owner:$owner, name:$repo) {
        issues(first:100, after:$after, states:[OPEN, CLOSED], orderBy:{field:CREATED_AT, direction:DESC}) {
          pageInfo { hasNextPage endCursor }
          nodes {
            number
            title
            state
            url
            createdAt
            updatedAt
          }
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
  return issues;
}

function buildCache(issues) {
  const versions = [];
  const seen = new Map();
  const duplicates = new Map();

  for (const issue of issues) {
    const m = issue.title?.match(TITLE_RE);
    if (!m) continue;
    const entry = {
      version: m[1],
      packageName: m[2],
      issueNumber: issue.number,
      title: issue.title,
      state: issue.state.toLowerCase(),
      url: issue.url,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    };
    versions.push(entry);
    if (seen.has(entry.version)) {
      if (!duplicates.has(entry.version)) duplicates.set(entry.version, [seen.get(entry.version)]);
      duplicates.get(entry.version).push(entry);
    } else {
      seen.set(entry.version, entry);
    }
  }

  versions.sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }));

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'github-graphql:repository.issues:title-only',
    repo: `${REPO_OWNER}/${REPO_NAME}`,
    versions,
    duplicates: Object.fromEntries([...duplicates.entries()].map(([version, entries]) => [version, entries])),
  };
}

const printVersions = process.argv.includes('--print-versions');
const issues = await fetchIssues();
const cache = buildCache(issues);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(cache, null, 2)}\n`);

if (printVersions) {
  for (const v of cache.versions) console.log(v.version);
} else {
  console.log(`Wrote ${cache.versions.length} version title(s) to ${OUT}`);
  const dupes = Object.keys(cache.duplicates);
  if (dupes.length) console.log(`Duplicate version title(s): ${dupes.join(', ')}`);
}
