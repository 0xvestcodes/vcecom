"use client";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Product } from "@/lib/types/products";
import { ProductTableRow } from "./product-table-row";

interface ProductsTableProps {
  products: Product[];
  onDeleteProduct: (productId: string) => void;
}

/**
 * Table component for displaying products list
 * Renders table structure with product rows
 */
export function ProductsTable({
  products,
  onDeleteProduct,
}: ProductsTableProps) {
  return (
    <div className="rounded-lg border border-border/50 overflow-hidden transition-all duration-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Image</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Variants</TableHead>
            <TableHead>Inventory</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <ProductTableRow
              key={product.id}
              product={product}
              onDelete={onDeleteProduct}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
