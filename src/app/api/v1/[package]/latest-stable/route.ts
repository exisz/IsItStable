import { NextResponse } from "next/server";
import { getLatestStable } from "@/lib/github";

type Props = { params: Promise<{ package: string }> };

export async function GET(_: Request, { params }: Props) {
  const { package: slug } = await params;
  const stable = await getLatestStable(slug);
  if (!stable) return NextResponse.json({ error: "No stable version found" }, { status: 404 });
  return NextResponse.json({
    package: slug,
    version: stable.version,
    verdict: "yes",
    comment: stable.verdictComment,
    install: `npm install ${slug}@${stable.version}`,
    thumbsUp: stable.thumbsUp,
    thumbsDown: stable.thumbsDown,
    issueUrl: stable.issueUrl,
    createdAt: stable.createdAt,
  }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60" } });
}
