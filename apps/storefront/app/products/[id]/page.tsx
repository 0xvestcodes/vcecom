import type { Metadata } from "next";
import { ProductDetail } from "@/components/products/product-detail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: _id } = await params;

  return {
    title: "Product",
    description: "Product details",
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ProductDetail productId={id} />;
}
