import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { CategoryCard } from "@/components/categories/category-card";
import { ProductCard } from "@/components/products/product-card";
import { Button } from "@/components/ui/button";
import { serverApiFetch } from "@/lib/server/api";

export default async function HomePage() {
  // Fetch data in parallel
  const [products, categories, collections] = await Promise.all([
    serverApiFetch<{
      data: Array<{
        id: string;
        title: string;
        price: number;
        images: string[];
        status: string;
      }>;
    }>("/store/products", {
      params: {
        limit: 8,
        status: "active",
        sortBy: "date",
        sortOrder: "desc",
      },
    }).catch(() => ({ data: [] })),
    serverApiFetch<
      Array<{
        id: string;
        name: string;
        slug?: string;
      }>
    >("/store/categories").catch(() => []),
    serverApiFetch<{
      data?: Array<{
        id: string;
        name: string;
        description?: string;
        image?: string;
      }>;
    }>("/store/collections").catch(() => ({ data: [] })),
  ]);

  // Normalize collections data - handle both array and object responses
  const collectionsData = Array.isArray(collections)
    ? { data: collections }
    : collections || { data: [] };

  return (
    <div className="min-h-screen">
      {/* Hero Banner */}
      <section className="relative w-full h-[600px] md:h-[700px] overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container relative z-10 h-full flex items-center">
          <div className="max-w-2xl">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Snag your style in a flash
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8">
              Buy, sell, and discover pre-loved gems from the trendiest brands.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg" className="text-lg px-8 py-6">
                <Link href="/products">Buy now</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="text-lg px-8 py-6"
              >
                <Link href="/products">Sell now</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Trending Listings */}
      <section className="py-16 bg-background">
        <div className="container">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl md:text-4xl font-bold">
              trending listings
            </h2>
            <Button variant="ghost" asChild>
              <Link href="/products" className="flex items-center gap-2">
                See More
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {products.data.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* Shop by Category */}
      <section className="py-16 bg-muted/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              SHOP BY CATEGORY
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
            {categories.slice(0, 5).map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        </div>
      </section>

      {/* Collection Showcase */}
      {collectionsData?.data && collectionsData.data.length > 0 && (
        <section className="py-16 bg-background">
          <div className="container">
            <div className="text-center mb-12">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                COLLECTION
              </span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2 mb-4">
                {collectionsData.data[0]?.name?.toUpperCase() ||
                  "FEATURED COLLECTION"}
              </h2>
              {collectionsData.data[0]?.description && (
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  {collectionsData.data[0].description}
                </p>
              )}
            </div>
            <div className="relative aspect-[16/9] rounded-lg overflow-hidden mb-8">
              {collectionsData.data[0]?.image ? (
                <Image
                  src={collectionsData.data[0].image}
                  alt={collectionsData.data[0]?.name || "Collection"}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-muted-foreground">
                    {collectionsData.data[0]?.name || "Featured Collection"}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-end p-8">
                <Button asChild size="lg" variant="secondary">
                  <Link
                    href={`/collections/${collectionsData.data[0]?.id || ""}`}
                  >
                    EXPLORE
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Shop by Style */}
      <section className="py-16 bg-muted/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              SHOP BY STYLE
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {["LUXURY", "VINTAGE", "CASUAL", "STREETWEAR", "Y2K"].map(
              (style) => (
                <Link
                  key={style}
                  href={`/products?style=${style.toLowerCase()}`}
                  className="group"
                >
                  <div className="aspect-square bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center hover:from-primary/20 hover:to-primary/10 transition-all duration-300 group-hover:scale-105">
                    <span className="font-bold text-lg group-hover:text-primary transition-colors">
                      {style}
                    </span>
                  </div>
                </Link>
              ),
            )}
          </div>
        </div>
      </section>

      {/* Stay Up to Date */}
      <section className="py-16 bg-background">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              STAY UP TO DATE
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "Summer's Most Elegant Accessories",
                description:
                  "Discover this season's most sophisticated accessories that blend timeless elegance with modern design.",
              },
              {
                title: "The Season's Hottest Trends",
                description:
                  "From bold colors to nostalgic silhouettes, explore the must-have looks defining this season's fashion narrative.",
              },
              {
                title: "Minimalist Outerwear Trends",
                description:
                  "Explore the latest minimalist outerwear pieces that combine functionality with clean aesthetics.",
              },
            ].map((post) => (
              <Link key={post.title} href="#" className="group block">
                <div className="aspect-video bg-muted rounded-lg mb-4 overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 group-hover:from-primary/20 group-hover:to-primary/10 transition-all duration-300" />
                </div>
                <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                  {post.title}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {post.description}
                </p>
                <span className="text-sm text-primary mt-2 inline-block group-hover:underline">
                  Read more
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
