import { getVersionBySlug, getPackageSummary, fetchAllVersionIssues } from "@/lib/data";
import { notFound } from "next/navigation";
import Link from "next/link";
import { VerdictBadge } from "@/components/VerdictBadge";
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
  const verdict = v.verdict === "yes" ? "Stable ✅" : v.verdict === "no" ? "Unstable 🔥" : "Pending 🤔";
  return {
    title: `Is ${v.packageName} v${version} Stable? | IsItStable.com`,
    description: `${v.packageName} v${version}: ${verdict}. ${v.verdictComment}`,
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

      {/* Big Verdict */}
      <div className="text-center py-16">
        <p className="text-[var(--color-muted)] text-lg mb-4">
          Is <span className="text-[var(--color-foreground)] font-bold">{pkg.displayName} v{version}</span> stable?
        </p>
        <VerdictBadge verdict={v.verdict} size="xl" />
      </div>

      {/* Comment */}
      {v.verdictComment && (
        <div className="border border-[var(--color-border)] rounded-xl p-8 mb-8 bg-[var(--color-card)] text-center">
          <p className="text-xl italic text-[var(--color-muted)] leading-relaxed">
            &ldquo;{v.verdictComment}&rdquo;
          </p>
        </div>
      )}

      {/* Stats + Votes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="👍 Stable" value={String(v.thumbsUp)} color={v.thumbsUp > 0 ? "text-[var(--color-yes)]" : undefined} />
        <StatCard label="👎 Unstable" value={String(v.thumbsDown)} color={v.thumbsDown > 0 ? "text-[var(--color-no)]" : undefined} />
        <StatCard label="npm Downloads" value={v.stats.npmDownloads ?? "—"} />
        <StatCard label="GitHub Issues" value={v.stats.githubIssuesCount ?? "—"} />
      </div>

      {/* Evidence / Referenced Issues */}
      {v.referencedIssues.length > 0 && (
        <div className="border border-[var(--color-border)] rounded-xl p-6 mb-8">
          <h3 className="text-sm uppercase tracking-widest text-[var(--color-muted)] mb-3">Referenced Issues</h3>
          <ul className="space-y-2">
            {v.referencedIssues.map((issue) => (
              <li key={`${issue.repo}#${issue.number}`}>
                <a
                  href={issue.url}
                  target="_blank"
                  rel="noopener"
                  className="text-[var(--color-muted)] hover:text-white transition-colors font-mono text-sm"
                >
                  {issue.repo}#{issue.number} →
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {v.evidenceSummary && (
        <div className="border border-[var(--color-border)] rounded-xl p-6 mb-8">
          <h3 className="text-sm uppercase tracking-widest text-[var(--color-muted)] mb-3">Evidence</h3>
          <p className="text-[var(--color-muted)] whitespace-pre-line">{v.evidenceSummary}</p>
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

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border border-[var(--color-border)] rounded-lg p-4 text-center">
      <p className="text-xs uppercase tracking-widest text-[var(--color-muted)] mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color ?? ""}`}>{value}</p>
    </div>
  );
}
