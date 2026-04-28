import { NextResponse } from "next/server";
import { getPackageVersions } from "@/lib/data";

type Props = { params: Promise<{ package: string }> };

export async function GET(_: Request, { params }: Props) {
  const { package: slug } = await params;
  const versions = await getPackageVersions(slug);
  if (versions.length === 0) return NextResponse.json({ error: "Package not found" }, { status: 404 });
  const latest = versions[0];
  return NextResponse.json({
    package: slug,
    version: latest.version,
    verdict: latest.verdict,
    comment: latest.verdictComment,
    thumbsUp: latest.thumbsUp,
    thumbsDown: latest.thumbsDown,
    issueUrl: latest.issueUrl,
    createdAt: latest.createdAt,
  }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60" } });
}
