import { notFound } from "next/navigation";
import { getProduct } from "@/app/actions/products";
import { Badge } from "@/components/ui/badge";
import { serverApiFetch } from "@/lib/server/api";
import { getProductWithStock } from "@/lib/server/products";
import { ProductForm } from "./product-form";
import { ProductImages } from "./product-images";
import { ProductPrice } from "./product-price";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id).catch(() => null);

  if (!product) {
    notFound();
  }

  // Check inventory status from variants
  type ProductType = {
    id: string;
    title: string;
    description: string | null;
    price: number;
    images: string[];
    status: string;
  };

  const typedProduct = product as ProductType;
  const productData = (await getProductWithStock(
    typedProduct,
  )) as ProductType & {
    inStock: boolean;
  };

  // Fetch variants
  const variants = await serverApiFetch<
    Array<{
      id: string;
      title: string | null;
      inventory: number;
      price?: number;
    }>
  >(`/store/products/${productData.id}/variants`).catch(() => []);

  return (
    <div className="container py-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <ProductImages
          images={productData.images || []}
          title={productData.title}
        />
        <div>
          <h1 className="text-3xl font-bold mb-4">{productData.title}</h1>
          <div className="flex items-center gap-4 mb-4">
            <ProductPrice
              price={productData.price}
              className="text-3xl font-bold"
            />
            {productData.inStock ? (
              <Badge>In Stock</Badge>
            ) : (
              <Badge variant="destructive">Out of Stock</Badge>
            )}
          </div>
          {productData.description && (
            <p className="text-muted-foreground mb-6">
              {String(productData.description)}
            </p>
          )}
          <ProductForm
            productId={productData.id}
            variants={variants}
            inStock={productData.inStock}
          />
        </div>
      </div>
    </div>
  );
}
