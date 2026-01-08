import { use } from "react";
import { MediaGroupEditorPanel } from "@/components/media-groups/media-group-editor-panel";

interface MediaGroupDetailPageProps {
  params: Promise<{ mediaGroupId: string }>;
}

/**
 * Media Group detail page - Server component
 * Extracts mediaGroupId from params and delegates to MediaGroupEditorPanel
 */
export default function MediaGroupDetailPage({
  params,
}: MediaGroupDetailPageProps) {
  const { mediaGroupId } = use(params);
  return <MediaGroupEditorPanel mediaGroupId={mediaGroupId} />;
}
