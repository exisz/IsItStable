export const STABLE_VIBES = [
  "Ship it 🚀",
  "All clear ✅",
  "Smooth sailing ⛵",
  "Chef's kiss 👨‍🍳",
  "Vibes: immaculate 💅",
  "Green light 🟢",
  "Send it 📬",
  "Touch grass approved 🌱",
  "Friday deploy safe 🎉",
  "No cap, it works 🧢",
  "Certified fresh 🍅",
  "Battle tested ⚔️",
  "Vet approved 🐕",
];

export const UNSTABLE_VIBES = [
  "Nope 🔥",
  "Hard pass ✋",
  "RIP your weekend 💀",
  "Rollback o'clock ⏰",
  "Proceed with caution ⚠️",
  "Your PM will hear about this 📧",
  "npm uninstall this 🗑️",
  "Friday deploy? Absolutely not 🚫",
  "Spicy 🌶️",
  "Trust issues 🤥",
  "Certified rotten 🍅",
  "Code red 🚨",
  "Abandon ship 🚢",
];

// Use a deterministic seed based on version string so the same version always shows the same vibe
export function getVibe(version: string, verdict: "yes" | "no" | "pending"): string {
  if (verdict === "pending") return "Awaiting verdict ⏳";
  const list = verdict === "yes" ? STABLE_VIBES : UNSTABLE_VIBES;
  // Simple hash from version string
  let hash = 0;
  for (let i = 0; i < version.length; i++) {
    hash = ((hash << 5) - hash) + version.charCodeAt(i);
    hash |= 0;
  }
  return list[Math.abs(hash) % list.length];
}
