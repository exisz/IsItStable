import type { VersionIssue } from "@/lib/data";
import { scoreTextColor } from "@/lib/score";
import Link from "next/link";

export function ScoreTrend({ versions, packageSlug }: { versions: VersionIssue[]; packageSlug: string }) {
  const points = versions.slice().reverse();
  if (points.length === 0) return null;

  const width = 720;
  const height = 220;
  const padX = 46;
  const padY = 34;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;
  const coords = points.map((v, index) => {
    const x = points.length === 1 ? width / 2 : padX + (index / (points.length - 1)) * plotW;
    const y = padY + (1 - v.stabilityScore.score / 100) * plotH;
    return { v, x, y };
  });
  const line = coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <section className="border border-[var(--color-border)] rounded-xl p-6 mb-8 bg-[var(--color-card)]">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm uppercase tracking-widest text-[var(--color-muted)]">Score history</h2>
          <p className="text-sm text-[var(--color-muted)] mt-1">Higher is less unstable. Click a dot to inspect the version.</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[620px] w-full h-48" role="img" aria-label="Version score trend">
          {[25, 50, 75, 100].map((tick) => {
            const y = padY + (1 - tick / 100) * plotH;
            return (
              <g key={tick}>
                <line x1={padX} x2={width - padX} y1={y} y2={y} stroke="currentColor" className="text-[var(--color-border)]" strokeDasharray="4 6" />
                <text x={4} y={y + 4} className="fill-[var(--color-muted)] text-[10px]">{tick}</text>
              </g>
            );
          })}
          <polyline fill="none" stroke="currentColor" className="text-[var(--color-muted)]" strokeWidth="2" points={line} />
          {coords.map(({ v, x, y }, index) => {
            const labelAbove = index % 2 === 0;
            const labelY = labelAbove ? y - 12 : y + 20;
            return (
              <Link key={v.issueNumber} href={`/${packageSlug}/${v.version}`}>
                <g className="hover:opacity-80 transition-opacity">
                  <circle cx={x} cy={y} r="6" fill={scoreTextColor(v.stabilityScore.score)} />
                  <text
                    x={x}
                    y={Math.max(12, Math.min(height - 6, labelY))}
                    textAnchor="middle"
                    className="fill-[var(--color-foreground)] text-[10px] font-mono"
                  >
                    {`v${v.version}`}
                  </text>
                  <text
                    x={x}
                    y={Math.max(24, Math.min(height - 6, labelY + 11))}
                    textAnchor="middle"
                    fill={scoreTextColor(v.stabilityScore.score)}
                    className="text-[10px] font-bold"
                  >
                    {v.stabilityScore.score}
                  </text>
                </g>
                <title>{`v${v.version}: ${v.stabilityScore.score}`}</title>
              </Link>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
