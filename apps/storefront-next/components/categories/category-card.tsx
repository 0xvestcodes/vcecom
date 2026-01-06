import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";

interface CategoryCardProps {
  category: {
    id: string;
    name: string;
    slug?: string;
    image?: string;
  };
}

export function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Link href={`/categories/${category.slug || category.id}`}>
      <Card className="group relative overflow-hidden border-0 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer h-full">
        <div className="aspect-square relative bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center overflow-hidden">
          {category.image ? (
            <Image
              src={category.image}
              alt={category.name}
              fill
              className="object-cover group-hover:scale-110 transition-transform duration-300"
            />
          ) : (
            <div className="text-center p-6">
              <h3 className="text-2xl font-bold mb-2 group-hover:text-primary transition-colors">
                {category.name}
              </h3>
              <ArrowRight className="h-6 w-6 mx-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
        </div>
        {category.image && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
            <h3 className="text-white font-semibold text-lg">
              {category.name}
            </h3>
          </div>
        )}
      </Card>
    </Link>
  );
}
