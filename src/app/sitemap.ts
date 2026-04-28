import type { MetadataRoute } from "next";
import { getPackages, getPackageVersions } from "@/lib/data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: "https://isitstable.com", lastModified: new Date(), changeFrequency: "daily", priority: 1 },
  ];

  const pkgs = await getPackages();
  for (const pkg of pkgs) {
    entries.push({
      url: `https://isitstable.com/${pkg.slug}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    });
    const versions = await getPackageVersions(pkg.slug);
    for (const v of versions.slice(0, 20)) {
      entries.push({
        url: `https://isitstable.com/${pkg.slug}/${v.version}`,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }

  return entries;
}
