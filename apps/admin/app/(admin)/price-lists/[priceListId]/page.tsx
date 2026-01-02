import { use } from "react";
import { PriceListEditorPanel } from "@/components/pricing/price-list-editor-panel";

interface PriceListDetailPageProps {
  params: Promise<{ priceListId: string }>;
}

/**
 * Price List detail page - Server component
 * Extracts priceListId from params and delegates to PriceListEditorPanel
 */
export default function PriceListDetailPage({
  params,
}: PriceListDetailPageProps) {
  const { priceListId } = use(params);
  return <PriceListEditorPanel priceListId={priceListId} />;
}
