import type { Metadata } from "next";
import { CategoriesList } from "@/components/categories/categories-list";
import { generateBaseMetadata } from "@/lib/seo/metadata-helpers";

export async function generateMetadata(): Promise<Metadata> {
  return generateBaseMetadata({
    title: "Categories",
    description: "Browse our product categories",
  });
}

export default async function CategoriesPage() {
  return <CategoriesList />;
}
