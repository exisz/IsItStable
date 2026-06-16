export function scoreHue(score: number): number {
  return Math.round(60 + (120 / Math.PI) * Math.atan((score - 50) / 35));
}

export function scoreStyle(score: number): { color: string; backgroundColor: string; borderColor: string } {
  const hue = scoreHue(score);
  return {
    color: `hsl(${hue} 84% 62%)`,
    backgroundColor: `hsl(${hue} 84% 50% / 0.10)`,
    borderColor: `hsl(${hue} 84% 50% / 0.35)`,
  };
}

export function scoreTextColor(score: number): string {
  const hue = scoreHue(score);
  return `hsl(${hue} 84% 62%)`;
}
