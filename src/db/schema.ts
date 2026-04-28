import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const packages = sqliteTable("packages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  githubRepo: text("github_repo").notNull(),
  registry: text("registry").notNull().default("npm"),
  displayName: text("display_name").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const versions = sqliteTable("versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  packageId: integer("package_id").notNull().references(() => packages.id),
  version: text("version").notNull(),
  releaseDate: text("release_date"),
  verdict: text("verdict", { enum: ["yes", "no", "pending"] }).notNull().default("pending"),
  verdictComment: text("verdict_comment"),
  evidenceSummary: text("evidence_summary"),
  npmDownloads: integer("npm_downloads"),
  githubIssuesCount: integer("github_issues_count"),
  breakingCount: integer("breaking_count"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const votes = sqliteTable("votes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  versionId: integer("version_id").notNull().references(() => versions.id),
  userId: text("user_id").notNull(),
  vote: text("vote", { enum: ["up", "down"] }).notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});
