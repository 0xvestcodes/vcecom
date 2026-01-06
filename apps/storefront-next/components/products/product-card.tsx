import { Eye } from "lucide-react";
import Link from "next/link";
import { PriceDisplay } from "@/components/common/price-display";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ResponsiveImage } from "./responsive-image";

interface ProductCardProps {
  product: {
    id: string;
    title: string;
    price: number;
    images: string[];
  };
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href={`/products/${product.id}`} className="group">
      <Card className="overflow-hidden border-0 shadow-sm hover:shadow-lg transition-all duration-300 group-hover:scale-[1.02]">
        <div className="aspect-square relative bg-muted overflow-hidden">
          {product.images?.[0] ? (
            <ResponsiveImage
              src={product.images[0]}
              alt={product.title}
              fill
              className="object-cover group-hover:scale-110 transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-gradient-to-br from-muted to-muted/50">
              <span className="text-sm">No Image</span>
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="secondary" className="rounded-full">
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-sm mb-1 line-clamp-2 group-hover:text-primary transition-colors">
            {product.title}
          </h3>
          <PriceDisplay
            value={product.price}
            className="text-lg font-bold text-primary"
          />
        </div>
      </Card>
    </Link>
  );
}
