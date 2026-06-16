import { getVersionBySlug, getPackageSummary, fetchAllVersionIssues } from "@/lib/data";
import { notFound } from "next/navigation";
import Link from "next/link";
import { InstallCommands } from "@/components/InstallCommands";
import { StabilityScoreCard } from "@/components/StabilityScoreCard";
import { ScoreBadge } from "@/components/ScoreBadge";
import type { Metadata } from "next";

type Props = { params: Promise<{ package: string; version: string }> };

export async function generateStaticParams() {
  const issues = await fetchAllVersionIssues();
  return issues.map((i) => ({ package: i.packageSlug, version: i.version }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { package: slug, version } = await params;
  const v = await getVersionBySlug(slug, version);
  if (!v) return {};
  return {
    title: `${v.packageName} v${version} Stability Score | IsItStable.com`,
    description: `${v.packageName} v${version}: stability score ${v.stabilityScore.score}. ${v.verdictComment}`,
  };
}

export default async function VersionPage({ params }: Props) {
  const { package: slug, version } = await params;
  const pkg = await getPackageSummary(slug);
  if (!pkg) notFound();
  const v = await getVersionBySlug(slug, version);
  if (!v) notFound();

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-4">
        <Link href={`/${slug}`} className="text-sm text-[var(--color-muted)] hover:text-white transition-colors">
          ← {pkg.displayName} versions
        </Link>
      </div>

      {/* Big Score */}
      <div className="text-center py-16">
        <p className="text-[var(--color-muted)] text-lg mb-4">
          Is <span className="text-[var(--color-foreground)] font-bold">{pkg.displayName} v{version}</span> stable?
        </p>
        <ScoreBadge score={v.stabilityScore.score} size="xl" mutedMax />
        <p className="mt-4 text-sm uppercase tracking-widest text-[var(--color-muted)]">
          Fact score: {v.stabilityScore.score} · evidence-based, not a YES/NO verdict
        </p>
      </div>

      {/* Comment */}
      {v.verdictComment && (
        <div className="border border-[var(--color-border)] rounded-xl p-8 mb-8 bg-[var(--color-card)] text-center">
          <p className="text-xl italic text-[var(--color-muted)] leading-relaxed">
            &ldquo;{v.verdictComment}&rdquo;
          </p>
        </div>
      )}

      <StabilityScoreCard stabilityScore={v.stabilityScore} />

      {/* Install */}
      <div className="border border-[var(--color-border)] rounded-xl p-6 mb-8 bg-[var(--color-card)]">
        <p className="text-xs uppercase tracking-widest text-[var(--color-muted)] mb-3">Install this version</p>
        <InstallCommands packageName={slug} version={v.version} />
      </div>

      {/* Stats + Votes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <StatCard
          label="👍 Stable"
          value={String(v.thumbsUp)}
          color={v.thumbsUp > 0 ? "text-[var(--color-yes)]" : undefined}
          voteHref={v.issueUrl}
        />
        <StatCard
          label="👎 Unstable"
          value={String(v.thumbsDown)}
          color={v.thumbsDown > 0 ? "text-[var(--color-no)]" : undefined}
          voteHref={v.issueUrl}
        />
      </div>

      {/* Stability Evidence */}
      {v.stabilityScore.evidence.length > 0 ? (
        <div className="border border-[var(--color-border)] rounded-xl p-6 mb-8 overflow-x-auto">
          <h3 className="text-sm uppercase tracking-widest text-[var(--color-muted)] mb-3">Score Evidence</h3>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-widest text-[var(--color-muted)]">
              <tr>
                <th className="py-2 pr-4">Issue</th>
                <th className="py-2 pr-4">Area</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Penalty</th>
                <th className="py-2 pr-4">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {v.stabilityScore.evidence.map((issue) => (
                <tr key={issue.issue}>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <a href={issue.url} target="_blank" rel="noopener" className="font-mono text-[var(--color-muted)] hover:text-white transition-colors">
                      {issue.issue} →
                    </a>
                  </td>
                  <td className="py-3 pr-4">{issue.area}</td>
                  <td className="py-3 pr-4 text-[var(--color-muted)]">{issue.type}</td>
                  <td className="py-3 pr-4 font-bold text-[var(--color-no)]">-{issue.penalty}</td>
                  <td className="py-3 pr-4 text-[var(--color-muted)]">{issue.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : v.referencedIssues.length > 0 && (
        <div className="border border-[var(--color-border)] rounded-xl p-6 mb-8">
          <h3 className="text-sm uppercase tracking-widest text-[var(--color-muted)] mb-3">Referenced Issues</h3>
          <ul className="space-y-2">
            {v.referencedIssues.map((issue) => (
              <li key={`${issue.repo}#${issue.number}`}>
                <a href={issue.url} target="_blank" rel="noopener" className="text-[var(--color-muted)] hover:text-white transition-colors font-mono text-sm">
                  {issue.repo}#{issue.number}{issue.title ? ` — ${issue.title}` : ''} →
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}


      {/* Vote on GitHub */}
      <div className="border border-[var(--color-border)] rounded-xl p-6 text-center bg-[var(--color-card)] mb-8">
        <h3 className="text-sm uppercase tracking-widest text-[var(--color-muted)] mb-4">Community Vote</h3>
        <p className="text-[var(--color-muted)] mb-4">
          React with 👍 (stable) or 👎 (unstable) on the GitHub issue
        </p>
        <a
          href={v.issueUrl}
          target="_blank"
          rel="noopener"
          className="inline-block bg-white text-black font-bold px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Vote on GitHub →
        </a>
      </div>

      {/* Discussion link */}
      <div className="text-center space-y-2">
        <a
          href={v.issueUrl}
          target="_blank"
          rel="noopener"
          className="text-sm text-[var(--color-muted)] hover:text-white transition-colors"
        >
          See discussion →
        </a>
        <br />
        <a
          href={`/api/v1/${slug}/${version}`}
          className="text-sm text-[var(--color-muted)] hover:text-white transition-colors font-mono"
        >
          📡 GET /api/v1/{slug}/{version}
        </a>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, voteHref }: { label: string; value: string; color?: string; voteHref?: string }) {
  return (
    <div className="border border-[var(--color-border)] rounded-lg p-4 bg-[var(--color-card)]">
      <div className="flex items-center justify-center gap-2 mb-2">
        <p className="text-xs uppercase tracking-widest text-[var(--color-muted)]">{label}</p>
        {voteHref && (
          <a
            href={voteHref}
            target="_blank"
            rel="noopener"
            aria-label={`Vote ${label.replace(/^[^A-Za-z]+/, "").toLowerCase()} on GitHub`}
            className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-foreground)] hover:border-[var(--color-muted)] hover:bg-white hover:text-black transition-colors"
          >
            Vote
          </a>
        )}
      </div>
      <p className={`text-center text-2xl font-bold ${color ?? ""}`}>{value}</p>
    </div>
  );
}
