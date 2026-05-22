import { getBestVersions, getPackageSummary, getPackages } from "@/lib/data";
import { notFound } from "next/navigation";
import Link from "next/link";
import { InstallCommands } from "@/components/InstallCommands";
import { ScoreBadge } from "@/components/ScoreBadge";
import { ScoreTrend } from "@/components/ScoreTrend";
import { VersionTable } from "@/components/VersionTable";
import type { Metadata } from "next";

type Props = { params: Promise<{ package: string }> };

export async function generateStaticParams() {
  const pkgs = await getPackages();
  return pkgs.map((p) => ({ package: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { package: slug } = await params;
  const pkg = await getPackageSummary(slug);
  if (!pkg) return {};
  return {
    title: `Is ${pkg.displayName} Stable? | IsItStable.com`,
    description: `Stability scores for ${pkg.displayName}. Check before you update.`,
  };
}

export default async function PackagePage({ params }: Props) {
  const { package: slug } = await params;
  const pkg = await getPackageSummary(slug);
  if (!pkg) notFound();

  const bestVersions = await getBestVersions(slug, 3);
  const best = bestVersions[0];
  const latest = pkg.versions[0];

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-4">
        <Link href="/" className="text-sm text-[var(--color-muted)] hover:text-white transition-colors">← All packages</Link>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl sm:text-5xl font-black">{pkg.displayName}</h1>
          <p className="text-[var(--color-muted)] mt-2">npm · {slug}</p>
        </div>
        {latest && <ScoreBadge score={latest.stabilityScore.score} size="lg" mutedMax />}
      </div>

      {/* Install */}
      <div className="border border-[var(--color-border)] rounded-xl p-6 mb-8 bg-[var(--color-card)]">
        <p className="text-xs uppercase tracking-widest text-[var(--color-muted)] mb-3">
          {best ? `Install best bet (v${best.version}, score ${best.stabilityScore.score})` : "Install latest"}
        </p>
        <InstallCommands packageName={slug} version={best?.version ?? latest?.version ?? "latest"} />
      </div>

      {bestVersions.length > 0 && (
        <section className="grid sm:grid-cols-3 gap-3 mb-8">
          {bestVersions.map((v, index) => (
            <Link key={v.issueNumber} href={`/${slug}/${v.version}`} className="border border-[var(--color-border)] rounded-xl p-4 bg-[var(--color-card)] hover:border-[var(--color-muted)] transition-colors">
              <p className="text-xs uppercase tracking-widest text-[var(--color-muted)] mb-2">Best bet #{index + 1}</p>
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono font-bold">v{v.version}</span>
                <ScoreBadge score={v.stabilityScore.score} size="sm" />
              </div>
            </Link>
          ))}
        </section>
      )}

      <ScoreTrend versions={pkg.versions} packageSlug={slug} />

      {/* Version History */}
      <h2 className="text-sm uppercase tracking-widest text-[var(--color-muted)] mb-4">Version History</h2>
      <VersionTable versions={pkg.versions} packageSlug={slug} />
    </div>
  );
}
