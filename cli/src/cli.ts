const API_BASE = "https://isitstable.com/api/v1";
const VERSION = "0.1.0";

const HELP = `
🔍 is-it-stable v${VERSION} — Should you update?

Usage:
  is-it-stable <package>                 Latest version verdict
  is-it-stable <package>@<version>       Specific version
  is-it-stable <package> --stable        Latest stable version
  is-it-stable --help                    Show this help
  is-it-stable --version                 Show version

Examples:
  is-it-stable openclaw
  is-it-stable react@19.0.0
  is-it-stable next --stable

More: https://isitstable.com
`.trim();

interface Verdict {
  package: string;
  version: string;
  verdict: string;
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

function verdictEmoji(verdict: string): string {
  switch (verdict.toLowerCase()) {
    case "yes":
      return "✅";
    case "no":
      return "❌";
    case "maybe":
      return "⚠️";
    default:
      return "❓";
  }
}

function verdictLabel(verdict: string): string {
  switch (verdict.toLowerCase()) {
    case "yes":
      return "Ship it 🚀";
    case "no":
      return "Hold off ⛔";
    case "maybe":
      return "Proceed with caution ⚠️";
    default:
      return verdict;
  }
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
        console.error(`\n   Submit a verdict: https://isitstable.com/${pkg}`);
        process.exit(1);
      }
      console.error(`Error: ${(body as any).error || res.statusText}`);
      process.exit(1);
    }

    const data = (await res.json()) as Verdict;
    const emoji = verdictEmoji(data.verdict);
    const label = verdictLabel(data.verdict);

    console.log();
    console.log(`  ${emoji} ${data.package}@${data.version} — ${label}`);
    if (data.comment) {
      console.log(`  "${data.comment}"`);
    }
    console.log();
    console.log(`  👍 ${data.thumbsUp}  👎 ${data.thumbsDown}`);
    console.log(`  Install: npm install ${data.package}@${data.version}`);
    console.log(`  More: https://isitstable.com/${data.package}/${data.version}`);
    console.log();
  } catch (err: any) {
    if (err.cause?.code === "ENOTFOUND") {
      console.error("Error: Could not reach isitstable.com. Check your connection.");
    } else {
      console.error(`Error: ${err.message}`);
    }
    process.exit(1);
  }
}

main();
