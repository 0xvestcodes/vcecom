import { use } from "react";
import { CollectionEditorPanel } from "@/components/collections/collection-editor-panel";

interface CollectionDetailPageProps {
  params: Promise<{ collectionId: string }>;
}

/**
 * Collection detail page - Server component
 * Extracts collectionId from params and delegates to CollectionEditorPanel
 */
export default function CollectionDetailPage({
  params,
}: CollectionDetailPageProps) {
  const { collectionId } = use(params);
  return <CollectionEditorPanel collectionId={collectionId} />;
}
