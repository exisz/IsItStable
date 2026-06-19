const API_BASE = "https://isitstable.com/api/v1";
const VERSION = "0.1.0";

const HELP = `
🔍 is-it-stable v${VERSION} — Stability score before you update

Usage:
  is-it-stable <package>                 Latest version score
  is-it-stable <package>@<version>       Specific version
  is-it-stable <package> --stable        Best-scoring version
  is-it-stable --help                    Show this help
  is-it-stable --version                 Show version

Examples:
  is-it-stable openclaw
  is-it-stable react@19.0.0
  is-it-stable next --stable

More: https://isitstable.com
`.trim();

interface ScoreResponse {
  package: string;
  version: string;
  score?: number;
  stabilityScore?: { score: number };
  comment: string;
  thumbsUp: number;
  thumbsDown: number;
  issueUrl?: string;
  createdAt?: string;
}

function parseArgs(args: string[]): { pkg: string; version?: string; stable: boolean } | null {
  const filtered = args.filter((a) => a !== "--stable");
  const stable = args.includes("--stable");
  const input = filtered[0];
  if (!input) return null;

  const atIdx = input.lastIndexOf("@");
  if (atIdx > 0) {
    return { pkg: input.slice(0, atIdx), version: input.slice(atIdx + 1), stable };
  }
  return { pkg: input, stable };
}

function scoreEmoji(score: number): string {
  if (score >= 80) return "🟢";
  if (score >= 60) return "🟡";
  if (score >= 40) return "🟠";
  return "🔴";
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    console.log(HELP);
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log(VERSION);
    process.exit(0);
  }

  const parsed = parseArgs(args);
  if (!parsed) {
    console.error("Error: No package specified. Run is-it-stable --help");
    process.exit(1);
  }

  const { pkg, version, stable } = parsed;

  // Build URL
  let url: string;
  if (version) {
    url = `${API_BASE}/${encodeURIComponent(pkg)}/${encodeURIComponent(version)}/verdict`;
  } else if (stable) {
    url = `${API_BASE}/${encodeURIComponent(pkg)}/latest-stable`;
  } else {
    url = `${API_BASE}/${encodeURIComponent(pkg)}/verdict`;
  }

  try {
    const res = await fetch(url);

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (res.status === 404) {
        console.error(`❓ Package "${pkg}" not found on IsItStable.com`);
        console.error(`\n   Request tracking: https://isitstable.com/${pkg}`);
        process.exit(1);
      }
      const message = typeof body.error === "string" ? body.error : res.statusText;
      console.error(`Error: ${message}`);
      process.exit(1);
    }

    const data = (await res.json()) as ScoreResponse;
    const score = data.score ?? data.stabilityScore?.score;
    if (typeof score !== "number") {
      console.error("Error: API response did not include a stability score");
      process.exit(1);
    }
    const emoji = scoreEmoji(score);

    console.log();
    console.log(`  ${emoji} ${data.package}@${data.version} — stability score ${score}/100`);
    if (data.comment) {
      console.log(`  "${data.comment}"`);
    }
    console.log();
    console.log(`  👍 ${data.thumbsUp}  👎 ${data.thumbsDown}`);
    console.log(`  Install: npm install ${data.package}@${data.version}`);
    console.log(`  More: https://isitstable.com/${data.package}/${data.version}`);
    console.log();
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    const cause = error.cause as { code?: string } | undefined;
    if (cause?.code === "ENOTFOUND") {
      console.error("Error: Could not reach isitstable.com. Check your connection.");
    } else {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

main();
