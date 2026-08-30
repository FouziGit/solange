import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { communities, communityById } from "@/lib/mock";
import { CommunityDetail } from "./CommunityDetail";

export function generateStaticParams() {
  return communities.map((c) => ({ id: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const c = communityById(id);
  return {
    title: c ? c.name : "Cercle",
    description: c?.tagline,
    alternates: { canonical: `/communaute/${id}` },
  };
}

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const community = communityById(id);
  if (!community) notFound();
  return <CommunityDetail community={community} />;
}
