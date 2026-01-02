import type { Metadata } from "next";
import { CollectionsList } from "@/components/collections/collections-list";
import { generateBaseMetadata } from "@/lib/seo/metadata-helpers";

export async function generateMetadata(): Promise<Metadata> {
  return generateBaseMetadata({
    title: "Collections",
    description: "Browse our product collections",
  });
}

export default async function CollectionsPage() {
  return <CollectionsList />;
}
