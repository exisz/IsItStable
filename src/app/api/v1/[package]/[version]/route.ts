import { NextResponse } from "next/server";
import { getPackage, getVersion } from "@/db/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ package: string; version: string }> };

export async function GET(_: Request, { params }: Props) {
  const { package: name, version } = await params;
  const pkg = await getPackage(name);
  if (!pkg) return NextResponse.json({ error: "Package not found" }, { status: 404 });
  const v = await getVersion(pkg.id, version);
  if (!v) return NextResponse.json({ error: "Version not found" }, { status: 404 });
  return NextResponse.json({
    package: pkg.name,
    version: v.version,
    verdict: v.verdict,
    comment: v.verdictComment,
    releaseDate: v.releaseDate,
    npmDownloads: v.npmDownloads,
    githubIssuesCount: v.githubIssuesCount,
    breakingCount: v.breakingCount,
  });
}
