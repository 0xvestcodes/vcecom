import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getBlogPost } from "@/lib/content/content";
import { generateBaseMetadata } from "@/lib/seo/metadata-helpers";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    return generateBaseMetadata({
      title: "Blog Post Not Found",
    });
  }

  // Use post-specific SEO, fallback to post data, then SEO global defaults
  const postTitle = post.seo?.title || post.title;
  const postDescription = post.seo?.description || post.excerpt;
  const postOgImage = post.seo?.og_image || post.featuredImage;

  return generateBaseMetadata({
    title: postTitle,
    description: postDescription,
    openGraph: {
      title: postTitle,
      description: postDescription,
      images: postOgImage ? [postOgImage] : undefined,
      type: "article",
    },
    twitter: {
      title: postTitle,
      description: postDescription,
      images: postOgImage ? [postOgImage] : undefined,
    },
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="container mx-auto px-4 py-8 max-w-4xl">
      {post.featuredImage && (
        <div className="mb-8 aspect-video overflow-hidden rounded-lg">
          <img
            src={post.featuredImage}
            alt={post.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
        {post.excerpt && (
          <p className="text-xl text-muted-foreground mb-4">{post.excerpt}</p>
        )}
        {post.publishedAt && (
          <time className="text-sm text-muted-foreground">
            {new Date(post.publishedAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
        )}
      </header>
      <div className="prose prose-lg max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {post.content}
        </ReactMarkdown>
      </div>
    </article>
  );
}
