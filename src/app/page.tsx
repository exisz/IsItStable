import { getAllPackages } from "@/db/queries";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const pkgs = await getAllPackages();

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
          {pkgs.map((pkg) => (
            <Link
              key={pkg.id}
              href={`/${pkg.name}`}
              className="block border border-[var(--color-border)] rounded-xl p-6 hover:border-[var(--color-muted)] transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold group-hover:underline">
                    {pkg.displayName}
                  </h3>
                  <p className="text-[var(--color-muted)] mt-1">
                    {pkg.registry}:{pkg.name} · <span className="text-[var(--color-foreground)]">{pkg.latestVersion?.version}</span>
                  </p>
                </div>
                {pkg.latestVersion && (
                  <div className={`text-4xl font-black ${
                    pkg.latestVersion.verdict === "yes" ? "text-[var(--color-yes)]" :
                    pkg.latestVersion.verdict === "no" ? "text-[var(--color-no)]" :
                    "text-[var(--color-pending)]"
                  }`}>
                    {pkg.latestVersion.verdict === "yes" ? "YES ✅" :
                     pkg.latestVersion.verdict === "no" ? "NO 🔥" : "🤔"}
                  </div>
                )}
              </div>
              {pkg.latestVersion?.verdictComment && (
                <p className="mt-3 text-[var(--color-muted)] text-sm italic">
                  &ldquo;{pkg.latestVersion.verdictComment}&rdquo;
                </p>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center mt-20 border border-[var(--color-border)] rounded-xl p-10">
        <h2 className="text-3xl font-bold mb-4">Want your package tracked? 📦</h2>
        <p className="text-[var(--color-muted)] mb-6">
          Open an issue on GitHub. We&apos;ll add it if enough people share the anxiety.
        </p>
        <a
          href="https://github.com/exisz/isitstable/issues/new"
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
