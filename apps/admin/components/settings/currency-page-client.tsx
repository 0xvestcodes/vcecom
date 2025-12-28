"use client";

import { DollarSign, Globe } from "lucide-react";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Currency settings page
 *
 * Note: Currently displays single currency (INR).
 * Multi-currency support requires backend implementation.
 */
export function CurrencyPageClient() {
  // TODO: Replace with actual currency data from API
  const currencies = [
    { code: "INR", name: "Indian Rupee", symbol: "₹", isDefault: true },
  ];

  const _currentCurrency = currencies.find((c) => c.isDefault) || currencies[0];

  return (
    <AdminPageLayout
      title="Currency Settings"
      description="Manage store currencies and exchange rates"
    >
      <div className="space-y-4">
        <Card className="rounded-xl border-border/50 bg-card/50">
          <CardHeader className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <CardTitle className="text-sm">Active Currencies</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Currencies available for your store
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {currencies.map((currency) => (
                <div
                  key={currency.code}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-card/30 p-3 transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs">
                          {currency.code}
                        </span>
                        {currency.isDefault && (
                          <Badge variant="default" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {currency.name} ({currency.symbol})
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="rounded-lg border border-border/50 bg-card/30 p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Currently only INR (Indian Rupee) is
            supported. Multi-currency support will be available in a future
            update.
          </p>
        </div>
      </div>
    </AdminPageLayout>
  );
}
