import { NextResponse } from "next/server";
import { getVersionBySlug } from "@/lib/data";

type Props = { params: Promise<{ package: string; version: string }> };

export async function GET(_: Request, { params }: Props) {
  const { package: slug, version } = await params;
  const v = await getVersionBySlug(slug, version);
  if (!v) return NextResponse.json({ error: "Version not found" }, { status: 404 });
  return NextResponse.json({
    package: slug,
    version: v.version,
    verdict: v.verdict,
    comment: v.verdictComment,
    thumbsUp: v.thumbsUp,
    thumbsDown: v.thumbsDown,
    referencedIssues: v.referencedIssues,
    issueUrl: v.issueUrl,
    createdAt: v.createdAt,
    stats: v.stats,
  }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60" } });
}
