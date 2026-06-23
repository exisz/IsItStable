#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const forbidden = [
  {
    name: 'direct OpenClaw GitHub issue URLs',
    pattern: /https:\/\/github\.com\/openclaw\/openclaw\/issues\/\d+/g,
  },
  {
    name: 'OpenClaw shorthand issue references',
    pattern: /openclaw\/openclaw#\d+/g,
  },
];

const defaultFiles = [
  'data/versions.json',
  'data/packages.json',
  'scripts/sync.ts',
  'src/lib/stability.ts',
];

const args = process.argv.slice(2);
let files = args.length ? args : defaultFiles;
if (args.includes('--staged')) {
  const output = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { cwd: root, encoding: 'utf8' });
  files = output.split('\n').filter(Boolean).filter((file) => /\.(json|md|ts|tsx|js|mjs|yml|yaml)$/.test(file));
}

let failed = false;
for (const file of files) {
  const abs = resolve(root, file);
  let text;
  try {
    text = readFileSync(abs, 'utf8');
  } catch {
    continue;
  }
  for (const rule of forbidden) {
    const matches = [...text.matchAll(rule.pattern)];
    if (!matches.length) continue;
    failed = true;
    const rel = relative(root, abs);
    const sample = matches.slice(0, 5).map((m) => m[0]).join(', ');
    console.error(`❌ ${rel} contains ${rule.name}: ${sample}`);
  }
}

if (failed) {
  console.error('\nUse redirect.github.com URLs and avoid owner/repo#123 shorthand in GitHub-written evidence.');
  process.exit(1);
}
console.log('✅ No OpenClaw backlink-generating references detected');
