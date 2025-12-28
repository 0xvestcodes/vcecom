import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">Welcome to VCEcom Storefront</h1>
      <p className="text-muted-foreground mb-8">
        Your modern ecommerce experience
      </p>
      <div className="flex gap-4 flex-wrap justify-center">
        <Link
          href="/products"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
        >
          Browse Products
        </Link>
        <Link
          href="/bundles"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
        >
          View Bundles
        </Link>
        <Link
          href="/cart"
          className="px-4 py-2 border border-border rounded-md hover:bg-accent"
        >
          View Cart
        </Link>
      </div>
    </div>
  );
}
