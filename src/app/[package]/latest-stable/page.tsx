import { getLatestStable } from "@/lib/github";
import { notFound, redirect } from "next/navigation";

export const revalidate = 120;

type Props = { params: Promise<{ package: string }> };

export default async function LatestStablePage({ params }: Props) {
  const { package: slug } = await params;
  const stable = await getLatestStable(slug);
  if (!stable) notFound();
  redirect(`/${slug}/${stable.version}`);
}
