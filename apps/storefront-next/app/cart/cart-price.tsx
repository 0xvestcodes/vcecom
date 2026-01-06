"use client";

import { useCurrency } from "@/lib/contexts/currency-context";
import { formatCurrency } from "@/lib/utils";

interface CartPriceProps {
  value: number;
  className?: string;
}

export function CartPrice({ value, className }: CartPriceProps) {
  const { selectedCurrency } = useCurrency();
  return (
    <span className={className}>{formatCurrency(value, selectedCurrency)}</span>
  );
}
