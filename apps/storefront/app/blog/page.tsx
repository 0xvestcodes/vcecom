import type { Metadata } from "next";
import Link from "next/link";
import { getBlogPosts } from "@/lib/content/content";
import { generateBaseMetadata } from "@/lib/seo/metadata-helpers";

export async function generateMetadata(): Promise<Metadata> {
  return generateBaseMetadata({
    title: "Blog",
    description: "Latest blog posts and articles",
  });
}

export default async function BlogPage() {
  const result = await getBlogPosts({ limit: 20, sortBy: "newest" });
  const posts = result.data;

  if (!posts || posts.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Blog</h1>
        <p className="text-muted-foreground">No blog posts found.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Blog</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="group block"
          >
            <article className="border rounded-lg p-6 hover:shadow-md transition-shadow">
              {post.featuredImage && (
                <div className="mb-4 aspect-video overflow-hidden rounded-md">
                  {/* biome-ignore lint/performance/noImgElement: Blog featured images, using Next.js Image would require additional props */}
                  <img
                    src={post.featuredImage}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
              )}
              <h2 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                {post.title}
              </h2>
              {post.excerpt && (
                <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
                  {post.excerpt}
                </p>
              )}
              {post.publishedAt && (
                <time className="text-xs text-muted-foreground">
                  {new Date(post.publishedAt).toLocaleDateString()}
                </time>
              )}
            </article>
          </Link>
        ))}
      </div>
    </div>
  );
}
