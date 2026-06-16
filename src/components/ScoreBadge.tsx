import { scoreStyle } from "@/lib/score";

export function ScoreBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" | "xl"; mutedMax?: boolean }) {
  const sizeClass = {
    sm: "text-sm px-2 py-0.5",
    md: "text-xl px-3 py-1",
    lg: "text-4xl px-4 py-2",
    xl: "text-7xl sm:text-8xl px-5 py-3",
  }[size];

  return (
    <span
      className={`inline-flex items-baseline rounded-xl border font-black tabular-nums ${sizeClass}`}
      style={scoreStyle(score)}
      title={`${score} stability score`}
    >
      {score}
    </span>
  );
}
