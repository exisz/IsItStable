import { NextResponse } from "next/server";
import { getPackageVersions } from "@/lib/github";

type Props = { params: Promise<{ package: string }> };

export async function GET(_: Request, { params }: Props) {
  const { package: slug } = await params;
  const versions = await getPackageVersions(slug);
  if (versions.length === 0) return NextResponse.json({ error: "Package not found" }, { status: 404 });
  return NextResponse.json({
    package: slug,
    versions: versions.map((v) => ({
      version: v.version,
      verdict: v.verdict,
      comment: v.verdictComment,
      thumbsUp: v.thumbsUp,
      thumbsDown: v.thumbsDown,
      issueUrl: v.issueUrl,
      createdAt: v.createdAt,
    })),
  }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60" } });
}
