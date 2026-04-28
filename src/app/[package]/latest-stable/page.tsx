import { getLatestStable } from "@/lib/data";
import { notFound, redirect } from "next/navigation";

type Props = { params: Promise<{ package: string }> };

export default async function LatestStablePage({ params }: Props) {
  const { package: slug } = await params;
  const stable = await getLatestStable(slug);
  if (!stable) notFound();
  redirect(`/${slug}/${stable.version}`);
}
