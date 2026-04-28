import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:./local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(client, { schema });

// Filtered stable versions from npm view openclaw versions
const stableVersions: { version: string; date: string; verdict: "yes" | "no"; comment: string; }[] = [
  { version: "2026.1.29", date: "2026-01-29", verdict: "yes", comment: "The OG. First stable release. Ran fine if you didn't breathe on it too hard. 🫡" },
  { version: "2026.1.30", date: "2026-01-30", verdict: "yes", comment: "Hotfix era. Actually more stable than the 'stable' release before it. Ironic." },
  { version: "2026.2.1", date: "2026-02-01", verdict: "yes", comment: "New month, new vibes. This one just works™. Ship it." },
  { version: "2026.2.2", date: "2026-02-02", verdict: "yes", comment: "Groundhog Day release. Woke up, deployed, no fires. Repeated." },
  { version: "2026.2.3", date: "2026-02-03", verdict: "yes", comment: "Three's a charm. Boringly stable. We love boring." },
  { version: "2026.2.6", date: "2026-02-06", verdict: "yes", comment: "Survived a Monday deployment. That's basically a medal of honor. 🎖️" },
  { version: "2026.2.9", date: "2026-02-09", verdict: "yes", comment: "Rock solid. Your CI pipeline called — it's happy for once." },
  { version: "2026.2.12", date: "2026-02-12", verdict: "yes", comment: "Valentine's eve energy. This version loves you back. 💚" },
  { version: "2026.2.13", date: "2026-02-13", verdict: "yes", comment: "Lucky 13. Despite superstition, zero crashes reported." },
  { version: "2026.2.14", date: "2026-02-14", verdict: "yes", comment: "Valentine's Day release. Committed to stability. Get it? 💍" },
  { version: "2026.2.15", date: "2026-02-15", verdict: "yes", comment: "Post-Valentine clarity. Clean, focused, no drama." },
  { version: "2026.2.17", date: "2026-02-17", verdict: "yes", comment: "Presidents' Day release. Presidential stability. No scandals." },
  { version: "2026.2.19", date: "2026-02-19", verdict: "yes", comment: "Smooth operator. Zero GitHub issues opened. Suspicious but welcome." },
  { version: "2026.2.21", date: "2026-02-21", verdict: "yes", comment: "Palindrome energy. Reads the same forwards and backwards: stable." },
  { version: "2026.2.22", date: "2026-02-22", verdict: "yes", comment: "Two-sday vibes. Double twos, double confidence." },
  { version: "2026.2.23", date: "2026-02-23", verdict: "yes", comment: "End of Feb strong finish. Winter hardened. Battle tested." },
  { version: "2026.2.24", date: "2026-02-24", verdict: "yes", comment: "February's last stand. Went out with grace." },
  { version: "2026.2.25", date: "2026-02-25", verdict: "yes", comment: "Leap into March prep. Solid foundation for what's next." },
  { version: "2026.2.26", date: "2026-02-26", verdict: "yes", comment: "February finale. Chef's kiss. 👨‍🍳" },
  { version: "2026.3.1", date: "2026-03-01", verdict: "yes", comment: "March comes in like a lamb. Gentle, stable, purring." },
  { version: "2026.3.2", date: "2026-03-02", verdict: "yes", comment: "Sequel that's better than the original. Rare." },
  { version: "2026.3.7", date: "2026-03-07", verdict: "yes", comment: "Lucky 7. This one has main character energy." },
  { version: "2026.3.8", date: "2026-03-08", verdict: "yes", comment: "International Women's Day release. Strong and dependable. 💪" },
  { version: "2026.3.11", date: "2026-03-11", verdict: "yes", comment: "Turned it up to 11. Still didn't break anything." },
  { version: "2026.3.12", date: "2026-03-12", verdict: "yes", comment: "A dozen reasons to trust this version. All of them are passing tests." },
  { version: "2026.3.13", date: "2026-03-13", verdict: "yes", comment: "Unlucky 13? Not this time. Defied all odds. 🍀" },
  { version: "2026.3.22", date: "2026-03-22", verdict: "yes", comment: "Spring equinox energy. Perfectly balanced, as all things should be." },
  { version: "2026.3.23", date: "2026-03-23", verdict: "yes", comment: "Post-equinox glow. Nature is healing, and so is this codebase." },
  { version: "2026.3.24", date: "2026-03-24", verdict: "yes", comment: "24/7 uptime energy. This version doesn't sleep." },
  { version: "2026.3.28", date: "2026-03-28", verdict: "yes", comment: "End of March banger. Closing Q1 with zero incidents." },
  { version: "2026.3.31", date: "2026-03-31", verdict: "yes", comment: "Q1 finale. If this was a TV season, it'd get renewed. 📺" },
  { version: "2026.4.1", date: "2026-04-01", verdict: "yes", comment: "April Fools? Nope, genuinely stable. The real joke is your other dependencies." },
  { version: "2026.4.2", date: "2026-04-02", verdict: "yes", comment: "No fooling today. Just vibes and green checkmarks. ✅" },
  { version: "2026.4.5", date: "2026-04-05", verdict: "yes", comment: "Weekend warrior release. Deployed on Friday, survived Monday. Legend." },
  { version: "2026.4.7", date: "2026-04-07", verdict: "yes", comment: "Monday release that didn't ruin your week. Unprecedented." },
  { version: "2026.4.8", date: "2026-04-08", verdict: "yes", comment: "Octave of perfection. Eight notes, all in harmony. 🎵" },
  { version: "2026.4.9", date: "2026-04-09", verdict: "yes", comment: "Cloud nine. This version is floating. Effortlessly stable." },
  { version: "2026.4.10", date: "2026-04-10", verdict: "yes", comment: "Perfect 10. Would recommend to friends, family, and sworn enemies." },
  { version: "2026.4.11", date: "2026-04-11", verdict: "yes", comment: "One louder than 10. Still stable. Spinal Tap approves." },
  { version: "2026.4.14", date: "2026-04-14", verdict: "yes", comment: "Tax day adjacent. At least THIS won't cost you money." },
  { version: "2026.4.15", date: "2026-04-15", verdict: "yes", comment: "Mid-April cruise control. Set it and forget it." },
  { version: "2026.4.16", date: "2026-04-16", verdict: "yes", comment: "Sweet sixteen. This version can finally drive. 🚗" },
  { version: "2026.4.17", date: "2026-04-17", verdict: "yes", comment: "Lucky streak continues. Stability is not a phase, mom." },
  { version: "2026.4.18", date: "2026-04-18", verdict: "yes", comment: "Legal drinking age in some countries. Mature and responsible." },
  { version: "2026.4.20", date: "2026-04-20", verdict: "yes", comment: "4/20. This version is chill. Very chill. 😌" },
  { version: "2026.4.21", date: "2026-04-21", verdict: "yes", comment: "Blackjack! 21 and winning. House always loses against this build." },
  { version: "2026.4.22", date: "2026-04-22", verdict: "yes", comment: "Earth Day release. Carbon neutral stability. 🌍" },
  { version: "2026.4.23", date: "2026-04-23", verdict: "yes", comment: "The chosen one. If you're only going to trust one version this month, make it this one. Ran in prod for 72 hours with zero hiccups. Your monitoring dashboard will be so bored it might fall asleep. 💤" },
  { version: "2026.4.24", date: "2026-04-24", verdict: "no", comment: "Hubris after 4.23. Something broke in the agent loop — phantom restarts reported by 3 users. Your Slack will have opinions. We recommend staying on 4.23 until this gets patched. 🔥" },
  { version: "2026.4.25", date: "2026-04-25", verdict: "no", comment: "Tried to fix 4.24, introduced a new friend: memory leak in long-running sessions. It's giving 'we'll fix it in the next one' energy. Narrator: they did not fix it in this one. 💀" },
];

async function seed() {
  console.log("🌱 Seeding database...");

  // Insert package
  await db.insert(schema.packages).values({
    name: "openclaw",
    githubRepo: "openclaw/openclaw",
    registry: "npm",
    displayName: "OpenClaw",
  }).onConflictDoNothing();

  const pkg = await db.query.packages.findFirst({ where: (p, { eq }) => eq(p.name, "openclaw") });
  if (!pkg) throw new Error("Package not found after insert");

  // Insert versions
  for (const v of stableVersions) {
    await db.insert(schema.versions).values({
      packageId: pkg.id,
      version: v.version,
      releaseDate: v.date,
      verdict: v.verdict,
      verdictComment: v.comment,
      evidenceSummary: v.verdict === "no" ? "GitHub issues reported by community" : "No significant issues reported",
      npmDownloads: Math.floor(Math.random() * 5000) + 500,
      githubIssuesCount: v.verdict === "no" ? Math.floor(Math.random() * 8) + 3 : Math.floor(Math.random() * 2),
      breakingCount: v.verdict === "no" ? Math.floor(Math.random() * 3) + 1 : 0,
    }).onConflictDoNothing();
  }

  console.log(`✅ Seeded ${stableVersions.length} versions for OpenClaw`);
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
