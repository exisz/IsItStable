import { getPackages, getLatestStable } from "@/lib/data";
import { getVibe } from "@/lib/vibes";
import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";

export default async function HomePage() {
  const pkgs = await getPackages();

  // Pre-fetch latest stable for each package
  const stableMap = new Map<string, Awaited<ReturnType<typeof getLatestStable>>>();
  for (const pkg of pkgs) {
    stableMap.set(pkg.slug, await getLatestStable(pkg.slug));
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      {/* Hero */}
      <section className="text-center mb-20">
        <h1 className="text-6xl sm:text-8xl font-black tracking-tight mb-6">
          Is It Stable<span className="text-[var(--color-muted)]">?</span>
        </h1>
        <p className="text-xl sm:text-2xl text-[var(--color-muted)] max-w-2xl mx-auto leading-relaxed">
          Because <code className="text-[var(--color-foreground)] bg-[var(--color-card)] px-2 py-0.5 rounded">npm update</code> shouldn&apos;t require a prayer circle. 🙏
        </p>
        <p className="mt-4 text-[var(--color-muted)]">
          Community-driven stability verdicts for packages you actually use.
        </p>
      </section>

      {/* Package List */}
      <section>
        <h2 className="text-sm uppercase tracking-widest text-[var(--color-muted)] mb-6">
          Tracked Packages
        </h2>
        <div className="space-y-4">
          {pkgs.map((pkg) => {
            const latestStable = stableMap.get(pkg.slug);
            const latest = pkg.latestVersion;
            const latestVibe = latest ? getVibe(latest.version, latest.verdict) : null;
            const installCmd = latestStable
              ? `npm install ${pkg.slug}@${latestStable.version}`
              : undefined;

            return (
              <Link
                key={pkg.slug}
                href={`/${pkg.slug}`}
                className="block border border-[var(--color-border)] rounded-xl p-6 hover:border-[var(--color-muted)] transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold group-hover:underline">
                      {pkg.displayName}
                    </h3>
                    <p className="text-[var(--color-muted)] mt-1">
                      Latest: <span className="text-[var(--color-foreground)]">v{latest?.version}</span>
                      {latest && (
                        <span className={`ml-2 text-sm ${
                          latest.verdict === "yes" ? "text-[var(--color-yes)]" :
                          latest.verdict === "no" ? "text-[var(--color-no)]" :
                          "text-[var(--color-pending)]"
                        }`}>
                          {latestVibe}
                        </span>
                      )}
                    </p>
                    {latestStable && (
                      <p className="mt-1">
                        <span className="inline-flex items-center gap-1.5 text-sm bg-[var(--color-yes)]/10 text-[var(--color-yes)] px-2 py-0.5 rounded-full font-medium">
                          🟢 Last stable: v{latestStable.version}
                        </span>
                      </p>
                    )}
                  </div>
                  {latest && (
                    <div className={`text-4xl font-black ${
                      latest.verdict === "yes" ? "text-[var(--color-yes)]" :
                      latest.verdict === "no" ? "text-[var(--color-no)]" :
                      "text-[var(--color-pending)]"
                    }`}>
                      {latest.verdict === "yes" ? "YES ✅" :
                       latest.verdict === "no" ? "NO 🔥" : "🤔"}
                    </div>
                  )}
                </div>
                {installCmd && (
                  <div className="mt-3 flex items-center gap-2">
                    <code className="text-xs font-mono text-[var(--color-muted)] bg-[var(--color-card)] px-2 py-1 rounded">{installCmd}</code>
                  </div>
                )}
                {latest?.verdictComment && (
                  <p className="mt-3 text-[var(--color-muted)] text-sm italic">
                    &ldquo;{latest.verdictComment}&rdquo;
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center mt-20 border border-[var(--color-border)] rounded-xl p-10">
        <h2 className="text-3xl font-bold mb-4">Want your package tracked? 📦</h2>
        <p className="text-[var(--color-muted)] mb-6">
          Open an issue on GitHub. We&apos;ll add it if enough people share the anxiety.
        </p>
        <a
          href="https://github.com/exisz/IsItStable/issues/new"
          target="_blank"
          rel="noopener"
          className="inline-block bg-white text-black font-bold px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Request a Package →
        </a>
      </section>
    </div>
  );
}
