import { use } from "react";
import { OrderEditorPanel } from "@/components/orders/order-editor-panel";

interface OrderDetailPageProps {
  params: Promise<{ orderId: string }>;
}

/**
 * Order detail page - Server component
 * Extracts orderId from params and delegates to OrderEditorPanel
 */
export default function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { orderId } = use(params);
  return <OrderEditorPanel orderId={orderId} />;
}
