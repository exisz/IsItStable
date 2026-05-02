# 🔍 IsItStable.com

> Community-driven stability verdicts for npm packages. Because `latest` doesn't mean `greatest`.

[![Website](https://img.shields.io/website?url=https%3A%2F%2Fisitstable.com&label=isitstable.com)](https://isitstable.com)
[![npm version](https://img.shields.io/npm/v/is-it-stable)](https://www.npmjs.com/package/is-it-stable)
[![npm downloads](https://img.shields.io/npm/dm/is-it-stable)](https://www.npmjs.com/package/is-it-stable)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub Issues](https://img.shields.io/github/issues/exisz/IsItStable)](https://github.com/exisz/IsItStable/issues)
[![Sponsor](https://img.shields.io/badge/sponsor-💛-yellow)](https://github.com/sponsors/exisz)

🌐 **Website:** [isitstable.com](https://isitstable.com) · 📦 **npm:** [is-it-stable](https://www.npmjs.com/package/is-it-stable) · 🐙 **GitHub:** [exisz/IsItStable](https://github.com/exisz/IsItStable)

---

## What is this?

**IsItStable** answers one question: *"Should I update?"*

Every tracked package version gets a **community verdict** — `YES ✅` (ship it) or `NO 🔥` (hold off). Verdicts are backed by evidence: referenced GitHub issues, download stats, and community votes via GitHub reactions.

## Install & Usage (CLI)

No install needed — just run:

```bash
npx is-it-stable openclaw
```

Or install globally:

```bash
npm install -g is-it-stable
is-it-stable openclaw
```

## How it works

1. **Version issues** are created in this repo with the format `[v2026.4.23] PackageName`
2. Each issue contains a **verdict** (YES/NO), humorous comment, and evidence links
3. **You vote** by reacting on the issue: 👍 = stable, 👎 = unstable
4. The website reads from GitHub Issues via API — no database needed

## API

All endpoints return JSON with `Cache-Control` headers.

### `GET /api/v1/{package}/verdict`

Latest verdict for a package.

```json
{
  "package": "openclaw",
  "version": "2026.4.23",
  "verdict": "yes",
  "comment": "Ship it and sleep like a baby.",
  "thumbsUp": 12,
  "thumbsDown": 1
}
```

### `GET /api/v1/{package}/versions`

All tracked versions for a package.

### `GET /api/v1/{package}/latest-stable`

Latest version with a YES verdict. Includes an `install` command.

### `GET /api/v1/{package}/{version}`

Detailed info for a specific version including referenced issues and stats.

## Request a new package

[Open an issue](https://github.com/exisz/IsItStable/issues/new) requesting the package you want tracked.

## Development

```bash
pnpm install
pnpm dev
```

Optionally set `GITHUB_TOKEN` in `.env.local` for higher API rate limits:

```
GITHUB_TOKEN=ghp_...
```

## Built with

- [Next.js](https://nextjs.org) — React framework with SSG + ISR
- [Vercel](https://vercel.com) — Hosting & edge caching
- [GitHub API](https://docs.github.com/en/rest) — Issues as database, reactions as votes
- [Tailwind CSS](https://tailwindcss.com) — Styling

## Contributing

1. Fork this repo
2. Create a feature branch
3. Submit a PR

For version verdicts, [open an issue](https://github.com/exisz/IsItStable/issues/new) instead.

## Sponsors

These legends help keep the lights on:

<!-- sponsors -->
| Avatar | Sponsor |
|--------|--------|
| <img src="https://avatars.githubusercontent.com/u/33719983?v=4" width="40" /> | **[dream zhao](https://github.com/Dts0)** |
<!-- /sponsors -->

Want to join them? [Become a sponsor →](https://github.com/sponsors/exisz) 💛

## License

MIT
