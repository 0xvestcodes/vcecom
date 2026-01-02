"use client";

import { ArrowLeft, Eye, EyeOff, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ImageUploadField } from "@/components/cms/image-upload-field";
import { SEOFields, type SEOFieldsData } from "@/components/cms/seo-fields";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useBlogPost,
  useCreateBlogPost,
  usePublishBlogPost,
  useUpdateBlogPost,
} from "@/hooks/blog/use-blog-posts";

interface BlogPostEditorClientProps {
  postId?: string;
}

export function BlogPostEditorClient({ postId }: BlogPostEditorClientProps) {
  const router = useRouter();
  const { data: post, isLoading } = useBlogPost(postId || "");
  const createMutation = useCreateBlogPost();
  const updateMutation = useUpdateBlogPost(postId || "");
  const publishMutation = usePublishBlogPost(postId || "");

  const [formData, setFormData] = useState({
    slug: "",
    title: "",
    excerpt: "",
    featuredImage: "",
    content: "",
    seo: {} as SEOFieldsData,
  });

  useEffect(() => {
    if (post) {
      setFormData({
        slug: post.slug || "",
        title: post.title || "",
        excerpt: post.excerpt || "",
        featuredImage: post.featuredImage || "",
        content: post.content || "",
        seo: {
          title: post.seo?.title,
          description: post.seo?.description,
          ogTitle: post.seo?.title,
          ogDescription: post.seo?.description,
          ogImages: post.seo?.og_image
            ? [{ url: post.seo.og_image, alt: "" }]
            : undefined,
        },
      });
    }
  }, [post]);

  const handleSave = async () => {
    try {
      // Convert SEOFieldsData to the format expected by the API
      const seoData = formData.seo;
      const ogImageUrl =
        Array.isArray(seoData.ogImages) && seoData.ogImages.length > 0
          ? seoData.ogImages[0].url
          : undefined;

      const data = {
        slug: formData.slug,
        title: formData.title,
        excerpt: formData.excerpt || undefined,
        featuredImage: formData.featuredImage || undefined,
        content: formData.content,
        seo: {
          title: seoData.title || undefined,
          description: seoData.description || undefined,
          og_image: ogImageUrl,
          // Include full SEO data for future use
          ...seoData,
        },
      };

      if (postId) {
        await updateMutation.mutateAsync(data);
        toast.success("Blog post updated");
      } else {
        const created = await createMutation.mutateAsync(data);
        toast.success("Blog post created");
        router.push(`/cms/blog/${created.id}/edit`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save blog post",
      );
    }
  };

  const handlePublish = async () => {
    if (!postId) {
      toast.error("Please save the post first");
      return;
    }

    try {
      await publishMutation.mutateAsync(!post?.published);
      toast.success(
        post?.published ? "Blog post unpublished" : "Blog post published",
      );
    } catch (error) {
      toast.error("Failed to update publish status");
    }
  };

  if (isLoading && postId) {
    return <div className="container mx-auto py-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.push("/cms/blog")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {postId ? "Edit Blog Post" : "Create Blog Post"}
          </h1>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value })
                }
                placeholder="my-blog-post"
              />
            </div>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Blog Post Title"
              />
            </div>
            <div>
              <Label htmlFor="excerpt">Excerpt</Label>
              <Textarea
                id="excerpt"
                value={formData.excerpt}
                onChange={(e) =>
                  setFormData({ ...formData, excerpt: e.target.value })
                }
                placeholder="Short description..."
                rows={3}
              />
            </div>
            <ImageUploadField
              label="Featured Image"
              value={formData.featuredImage || null}
              onChange={(url) =>
                setFormData({ ...formData, featuredImage: url || "" })
              }
              prefix="cms/blog/featured"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
            <CardDescription>Markdown content</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
              placeholder="# Blog Post Content

Write your blog post content here in Markdown..."
              className="font-mono min-h-[400px]"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SEO</CardTitle>
            <CardDescription>
              Comprehensive SEO fields matching Next.js Metadata object
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SEOFields
              value={formData.seo}
              onChange={(seo) => setFormData({ ...formData, seo })}
              prefix="cms/blog/seo"
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          {postId && (
            <Button
              variant="outline"
              onClick={handlePublish}
              disabled={publishMutation.isPending}
            >
              {post?.published ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Unpublish
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Publish
                </>
              )}
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {createMutation.isPending || updateMutation.isPending
              ? "Saving..."
              : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
