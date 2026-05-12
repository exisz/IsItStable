import type { StabilityScore } from "@/lib/stability";

function scoreColor(score: number) {
  if (score >= 90) return "text-[var(--color-yes)]";
  if (score >= 70) return "text-[var(--color-pending)]";
  return "text-[var(--color-no)]";
}

export function StabilityScoreCard({ stabilityScore }: { stabilityScore: StabilityScore }) {
  const s = stabilityScore;
  return (
    <div className="border border-[var(--color-border)] rounded-xl p-6 mb-8 bg-[var(--color-card)]">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--color-muted)] mb-2">Stability Score</p>
          <p className={`text-6xl font-black ${scoreColor(s.score)}`}>{s.score}<span className="text-2xl text-[var(--color-muted)]">/100</span></p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <MiniStat label="Evidence" value={`-${s.evidencePenalty}`} />
          <MiniStat label="Votes" value={`-${s.votePenalty}`} />
          <MiniStat label="Verdict" value={s.verdict.toUpperCase()} />
        </div>
      </div>

      {s.affected.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--color-muted)] mb-2">Affected components</p>
          <div className="flex flex-wrap gap-2">
            {s.affected.map((component) => (
              <span key={component} className="rounded-full border border-[var(--color-border)] px-3 py-1 text-sm text-[var(--color-muted)]">
                {component}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] px-3 py-2 min-w-24">
      <p className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}
