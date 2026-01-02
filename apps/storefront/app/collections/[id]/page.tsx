import type { Metadata } from "next";
import { CollectionDetail } from "@/components/collections/collection-detail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  return {
    title: "Collection",
    description: "Browse collection products",
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <CollectionDetail collectionId={id} />;
}
