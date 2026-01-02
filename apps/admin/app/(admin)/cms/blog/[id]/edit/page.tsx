"use client";

import { use } from "react";
import { BlogPostEditorClient } from "@/components/blog/blog-post-editor-client";

interface BlogPostEditPageProps {
  params: Promise<{ id: string }>;
}

export default function BlogPostEditPage({ params }: BlogPostEditPageProps) {
  const { id } = use(params);
  return <BlogPostEditorClient postId={id} />;
}
