import { NextResponse } from "next/server";
import { getPackage, getVersions } from "@/db/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ package: string }> };

export async function GET(_: Request, { params }: Props) {
  const { package: name } = await params;
  const pkg = await getPackage(name);
  if (!pkg) return NextResponse.json({ error: "Package not found" }, { status: 404 });
  const vers = await getVersions(pkg.id);
  const latest = vers[0];
  if (!latest) return NextResponse.json({ error: "No versions found" }, { status: 404 });
  return NextResponse.json({
    package: pkg.name,
    version: latest.version,
    verdict: latest.verdict,
    comment: latest.verdictComment,
    releaseDate: latest.releaseDate,
  });
}
