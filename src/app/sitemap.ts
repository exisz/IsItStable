import type { MetadataRoute } from "next";
import { db } from "@/db";
import { packages, versions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: "https://isitstable.com", lastModified: new Date(), changeFrequency: "daily", priority: 1 },
  ];

  const pkgs = await db.query.packages.findMany();
  for (const pkg of pkgs) {
    entries.push({
      url: `https://isitstable.com/${pkg.name}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    });
    const vers = await db.query.versions.findMany({
      where: eq(versions.packageId, pkg.id),
      orderBy: desc(versions.id),
      limit: 20,
    });
    for (const v of vers) {
      entries.push({
        url: `https://isitstable.com/${pkg.name}/${v.version}`,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }

  return entries;
}
