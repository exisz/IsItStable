import { getPackage, getVersion } from "@/db/queries";
import { notFound } from "next/navigation";
import Link from "next/link";
import { VerdictBadge } from "@/components/VerdictBadge";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ package: string; version: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { package: name, version } = await params;
  const pkg = await getPackage(name);
  if (!pkg) return {};
  const v = await getVersion(pkg.id, version);
  if (!v) return {};
  const verdict = v.verdict === "yes" ? "Stable ✅" : v.verdict === "no" ? "Unstable 🔥" : "Pending 🤔";
  return {
    title: `Is ${pkg.displayName} v${version} Stable? | IsItStable.com`,
    description: `${pkg.displayName} v${version}: ${verdict}. ${v.verdictComment}`,
  };
}

export default async function VersionPage({ params }: Props) {
  const { package: name, version } = await params;
  const pkg = await getPackage(name);
  if (!pkg) notFound();
  const v = await getVersion(pkg.id, version);
  if (!v) notFound();

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-4">
        <Link href={`/${name}`} className="text-sm text-[var(--color-muted)] hover:text-white transition-colors">
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
      <div className="border border-[var(--color-border)] rounded-xl p-8 mb-8 bg-[var(--color-card)] text-center">
        <p className="text-xl italic text-[var(--color-muted)] leading-relaxed">
          &ldquo;{v.verdictComment}&rdquo;
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="npm Downloads" value={v.npmDownloads?.toLocaleString() ?? "—"} />
        <StatCard label="GitHub Issues" value={String(v.githubIssuesCount ?? 0)} />
        <StatCard label="Breaking Changes" value={String(v.breakingCount ?? 0)} color={v.breakingCount ? "text-[var(--color-no)]" : undefined} />
        <StatCard label="Released" value={v.releaseDate ?? "—"} />
      </div>

      {/* Evidence */}
      {v.evidenceSummary && (
        <div className="border border-[var(--color-border)] rounded-xl p-6 mb-8">
          <h3 className="text-sm uppercase tracking-widest text-[var(--color-muted)] mb-3">Evidence</h3>
          <p className="text-[var(--color-muted)]">{v.evidenceSummary}</p>
        </div>
      )}

      {/* Vote Widget (disabled) */}
      <div className="border border-[var(--color-border)] rounded-xl p-6 text-center bg-[var(--color-card)]">
        <h3 className="text-sm uppercase tracking-widest text-[var(--color-muted)] mb-4">Community Vote</h3>
        <div className="flex items-center justify-center gap-6">
          <button disabled className="opacity-40 cursor-not-allowed px-6 py-3 rounded-lg border border-[var(--color-border)] text-lg font-bold">
            👍 Stable
          </button>
          <button disabled className="opacity-40 cursor-not-allowed px-6 py-3 rounded-lg border border-[var(--color-border)] text-lg font-bold">
            👎 Unstable
          </button>
        </div>
        <p className="text-xs text-[var(--color-muted)] mt-3">Sign in to vote (coming soon)</p>
      </div>

      {/* JSON API link */}
      <div className="mt-8 text-center">
        <a
          href={`/api/v1/${name}/${version}`}
          className="text-sm text-[var(--color-muted)] hover:text-white transition-colors font-mono"
        >
          📡 GET /api/v1/{name}/{version}
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
