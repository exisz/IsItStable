import { NextResponse } from "next/server";
import { getPackage, getVersions } from "@/db/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ package: string }> };

export async function GET(_: Request, { params }: Props) {
  const { package: name } = await params;
  const pkg = await getPackage(name);
  if (!pkg) return NextResponse.json({ error: "Package not found" }, { status: 404 });
  const vers = await getVersions(pkg.id);
  return NextResponse.json({
    package: pkg.name,
    versions: vers.map((v) => ({
      version: v.version,
      verdict: v.verdict,
      comment: v.verdictComment,
      releaseDate: v.releaseDate,
    })),
  });
}
