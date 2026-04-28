import { getPackage, getVersions, getLatestStable } from "@/db/queries";
import { notFound } from "next/navigation";
import Link from "next/link";
import { VerdictBadge } from "@/components/VerdictBadge";
import { CopyButton } from "@/components/CopyButton";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ package: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { package: name } = await params;
  const pkg = await getPackage(name);
  if (!pkg) return {};
  return {
    title: `Is ${pkg.displayName} Stable? | IsItStable.com`,
    description: `Stability verdicts for ${pkg.displayName}. Check before you update.`,
  };
}

export default async function PackagePage({ params }: Props) {
  const { package: name } = await params;
  const pkg = await getPackage(name);
  if (!pkg) notFound();

  const allVersions = await getVersions(pkg.id);
  const latestStable = await getLatestStable(pkg.id);
  const latest = allVersions[0];

  const installCmd = latestStable
    ? `npm install ${pkg.name}@${latestStable.version}`
    : `npm install ${pkg.name}`;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-4">
        <Link href="/" className="text-sm text-[var(--color-muted)] hover:text-white transition-colors">← All packages</Link>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl sm:text-5xl font-black">{pkg.displayName}</h1>
          <p className="text-[var(--color-muted)] mt-2">
            <a href={`https://github.com/${pkg.githubRepo}`} target="_blank" rel="noopener" className="hover:text-white transition-colors">
              {pkg.githubRepo}
            </a>
            {" · "}{pkg.registry}
          </p>
        </div>
        {latest && <VerdictBadge verdict={latest.verdict} size="lg" />}
      </div>

      {/* Install */}
      <div className="border border-[var(--color-border)] rounded-xl p-6 mb-10 bg-[var(--color-card)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--color-muted)] mb-2">
              {latestStable ? "Latest stable version" : "Latest version (⚠️ not stable)"}
            </p>
            <code className="text-lg font-mono">{installCmd}</code>
          </div>
          <CopyButton text={installCmd} />
        </div>
      </div>

      {/* Version History */}
      <h2 className="text-sm uppercase tracking-widest text-[var(--color-muted)] mb-4">Version History</h2>
      <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[var(--color-card)] text-xs uppercase tracking-widest text-[var(--color-muted)]">
            <tr>
              <th className="px-6 py-3">Version</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Verdict</th>
              <th className="px-6 py-3 hidden sm:table-cell">Comment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {allVersions.map((v) => (
              <tr key={v.id} className="hover:bg-[var(--color-card)] transition-colors">
                <td className="px-6 py-4">
                  <Link href={`/${name}/${v.version}`} className="font-mono hover:underline font-bold">
                    {v.version}
                  </Link>
                </td>
                <td className="px-6 py-4 text-[var(--color-muted)]">{v.releaseDate}</td>
                <td className="px-6 py-4">
                  <VerdictBadge verdict={v.verdict} size="sm" />
                </td>
                <td className="px-6 py-4 text-[var(--color-muted)] text-sm hidden sm:table-cell max-w-xs truncate">
                  {v.verdictComment}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
