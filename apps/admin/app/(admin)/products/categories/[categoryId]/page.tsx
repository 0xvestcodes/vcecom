import { use } from "react";
import { CategoryEditorPanel } from "@/components/categories/category-editor-panel";

interface CategoryDetailPageProps {
  params: Promise<{ categoryId: string }>;
}

/**
 * Category detail page - Server component
 * Extracts categoryId from params and delegates to CategoryEditorPanel
 */
export default function CategoryDetailPage({
  params,
}: CategoryDetailPageProps) {
  const { categoryId } = use(params);
  return <CategoryEditorPanel categoryId={categoryId} />;
}
