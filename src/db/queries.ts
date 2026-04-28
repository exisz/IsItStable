import { db } from "@/db";
import { packages, versions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function getPackage(name: string) {
  return db.query.packages.findFirst({ where: eq(packages.name, name) });
}

export async function getAllPackages() {
  const pkgs = await db.query.packages.findMany();
  const result = [];
  for (const pkg of pkgs) {
    const latest = await db.query.versions.findFirst({
      where: eq(versions.packageId, pkg.id),
      orderBy: desc(versions.id),
    });
    result.push({ ...pkg, latestVersion: latest });
  }
  return result;
}

export async function getVersions(packageId: number) {
  return db.query.versions.findMany({
    where: eq(versions.packageId, packageId),
    orderBy: desc(versions.id),
  });
}

export async function getVersion(packageId: number, version: string) {
  return db.query.versions.findFirst({
    where: (v, { and, eq }) => and(eq(v.packageId, packageId), eq(v.version, version)),
  });
}

export async function getLatestStable(packageId: number) {
  return db.query.versions.findFirst({
    where: (v, { and, eq }) => and(eq(v.packageId, packageId), eq(v.verdict, "yes")),
    orderBy: desc(versions.id),
  });
}
