import type { Metadata } from "next";
import { ProductsList } from "@/components/products/products-list";
import { generateBaseMetadata } from "@/lib/seo/metadata-helpers";

export async function generateMetadata(): Promise<Metadata> {
  return generateBaseMetadata({
    title: "Products",
    description: "Browse our products",
  });
}

export default async function ProductsPage() {
  return <ProductsList />;
}
