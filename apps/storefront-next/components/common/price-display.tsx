"use client";

import { useCurrency } from "@/lib/contexts/currency-context";
import { formatCurrency } from "@/lib/utils";

interface PriceDisplayProps {
  value: number;
  className?: string;
}

export function PriceDisplay({ value, className }: PriceDisplayProps) {
  const { selectedCurrency } = useCurrency();
  return (
    <span className={className}>{formatCurrency(value, selectedCurrency)}</span>
  );
}
