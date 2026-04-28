import { getPackageSummary, getLatestStable, getPackages } from "@/lib/github";
import { notFound } from "next/navigation";
import Link from "next/link";
import { VerdictBadge } from "@/components/VerdictBadge";
import { CopyButton } from "@/components/CopyButton";
import type { Metadata } from "next";

export const revalidate = 120;

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
    description: `Stability verdicts for ${pkg.displayName}. Check before you update.`,
  };
}

export default async function PackagePage({ params }: Props) {
  const { package: slug } = await params;
  const pkg = await getPackageSummary(slug);
  if (!pkg) notFound();

  const latestStable = await getLatestStable(slug);
  const latest = pkg.versions[0];

  const installCmd = latestStable
    ? `npm install ${slug}@${latestStable.version}`
    : `npm install ${slug}`;

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
              <th className="px-6 py-3">Votes</th>
              <th className="px-6 py-3 hidden sm:table-cell">Comment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {pkg.versions.map((v) => (
              <tr key={v.issueNumber} className="hover:bg-[var(--color-card)] transition-colors">
                <td className="px-6 py-4">
                  <Link href={`/${slug}/${v.version}`} className="font-mono hover:underline font-bold">
                    v{v.version}
                  </Link>
                </td>
                <td className="px-6 py-4 text-[var(--color-muted)]">{new Date(v.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-4">
                  <VerdictBadge verdict={v.verdict} size="sm" />
                </td>
                <td className="px-6 py-4 text-[var(--color-muted)]">
                  👍 {v.thumbsUp} · 👎 {v.thumbsDown}
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
