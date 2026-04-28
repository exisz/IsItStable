import { NextResponse } from "next/server";
import { getPackage, getLatestStable } from "@/db/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ package: string }> };

export async function GET(_: Request, { params }: Props) {
  const { package: name } = await params;
  const pkg = await getPackage(name);
  if (!pkg) return NextResponse.json({ error: "Package not found" }, { status: 404 });
  const stable = await getLatestStable(pkg.id);
  if (!stable) return NextResponse.json({ error: "No stable version found" }, { status: 404 });
  return NextResponse.json({
    package: pkg.name,
    version: stable.version,
    verdict: "yes",
    comment: stable.verdictComment,
    install: `npm install ${pkg.name}@${stable.version}`,
    releaseDate: stable.releaseDate,
  });
}
