import { getPackage, getLatestStable } from "@/db/queries";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ package: string }> };

export default async function LatestStablePage({ params }: Props) {
  const { package: name } = await params;
  const pkg = await getPackage(name);
  if (!pkg) notFound();
  const stable = await getLatestStable(pkg.id);
  if (!stable) notFound();
  redirect(`/${name}/${stable.version}`);
}
