import type { StabilityScore } from "@/lib/stability";
import { ScoreBadge } from "@/components/ScoreBadge";

export function StabilityScoreCard({ stabilityScore }: { stabilityScore: StabilityScore }) {
  const s = stabilityScore;
  return (
    <div className="border border-[var(--color-border)] rounded-xl p-6 mb-8 bg-[var(--color-card)]">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--color-muted)] mb-2">Stability Score</p>
          <ScoreBadge score={s.score} size="xl" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
          <MiniStat label="Base" value={String(s.formula.baseScore)} />
          <MiniStat label="Evidence" value={`-${s.formula.evidencePenalty}`} />
          <MiniStat label="Votes" value={`-${s.formula.votePenalty}`} />
          <MiniStat label="Survived" value={`+${s.formula.survivalBonus}`} />
          <MiniStat label="Curated" value={`+${s.formula.curatedBonus}`} />
        </div>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-black/10 px-4 py-3 mb-5 font-mono text-sm text-[var(--color-muted)] overflow-x-auto">
        <span className="text-[var(--color-foreground)]">{s.formula.baseScore}</span> base
        <span className="mx-2">−</span><span className="text-[var(--color-no)]">{s.formula.evidencePenalty}</span> evidence
        <span className="mx-2">−</span><span className="text-[var(--color-no)]">{s.formula.votePenalty}</span> votes
        <span className="mx-2">+</span><span className="text-[var(--color-yes)]">{s.formula.survivalBonus}</span> ({s.formula.survivalPointsPerDay}×{s.formula.survivalCreditedDays} days survived)
        {s.formula.curatedBonus > 0 && (
          <>
            <span className="mx-2">+</span><span className="text-[var(--color-yes)]">{s.formula.curatedBonus}</span> curated
          </>
        )}
        <span className="mx-2">=</span><span className="text-[var(--color-foreground)] font-bold">{s.formula.score}</span>
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
