import { getVibe } from "@/lib/vibes";

export function VerdictBadge({ verdict, size = "lg", version }: { verdict: string; size?: "sm" | "lg" | "xl"; version?: string }) {
  const sizeClasses = {
    sm: "text-sm px-2 py-0.5",
    lg: "text-2xl px-4 py-1",
    xl: "text-6xl sm:text-8xl px-6 py-2",
  };

  const color = verdict === "yes" ? "text-[var(--color-yes)]" :
                verdict === "no" ? "text-[var(--color-no)]" :
                "text-[var(--color-pending)]";

  const label = verdict === "yes" ? "YES ✅" :
                verdict === "no" ? "NO 🔥" : "PENDING 🤔";

  const vibe = version ? getVibe(version, verdict as "yes" | "no" | "pending") : null;

  return (
    <span className={`font-black ${sizeClasses[size]} ${color}`}>
      {label}
      {vibe && <span className={`block font-medium ${size === "xl" ? "text-2xl mt-2" : size === "lg" ? "text-base mt-1" : "text-xs"}`}>{vibe}</span>}
    </span>
  );
}
