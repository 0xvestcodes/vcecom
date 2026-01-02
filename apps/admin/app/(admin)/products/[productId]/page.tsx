import { use } from "react";
import { ProductEditorPanel } from "@/components/products/product-editor-panel";

interface ProductDetailPageProps {
  params: Promise<{ productId: string }>;
}

/**
 * Product detail page - Server component
 * Extracts productId from params and delegates to ProductEditorPanel
 */
export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { productId } = use(params);
  return <ProductEditorPanel productId={productId} />;
}
