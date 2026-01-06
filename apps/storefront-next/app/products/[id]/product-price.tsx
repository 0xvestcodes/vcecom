"use client";

import { useCurrency } from "@/lib/contexts/currency-context";
import { formatCurrency } from "@/lib/utils";

interface ProductPriceProps {
  price: number;
  className?: string;
}

export function ProductPrice({ price, className }: ProductPriceProps) {
  const { selectedCurrency } = useCurrency();
  return (
    <span className={className}>{formatCurrency(price, selectedCurrency)}</span>
  );
}
