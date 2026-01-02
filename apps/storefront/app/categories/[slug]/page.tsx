import type { Metadata } from "next";
import { CategoryDetail } from "@/components/categories/category-detail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  return {
    title: `Category: ${slug}`,
    description: `Products in ${slug} category`,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <CategoryDetail slug={slug} />;
}
