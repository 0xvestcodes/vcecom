"use client";

import { Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrency } from "@/lib/contexts/currency-context";

export function CurrencySelector() {
  const { selectedCurrency, currencies, isLoading, setCurrency } =
    useCurrency();

  if (isLoading || currencies.length === 0) {
    return null;
  }

  return (
    <Select
      value={selectedCurrency}
      onValueChange={(value) => setCurrency(value)}
    >
      <SelectTrigger className="w-[120px] h-9">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {currencies.map((currency) => (
          <SelectItem key={currency.code} value={currency.code}>
            <div className="flex items-center gap-2">
              <span className="font-medium">{currency.code}</span>
              <span className="text-muted-foreground text-xs">
                {currency.symbol}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
