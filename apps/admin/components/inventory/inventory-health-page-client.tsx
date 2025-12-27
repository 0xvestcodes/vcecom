"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Package,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { QueryState } from "@/components/common/query-state";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorDisplay } from "@/components/ui/error-display";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useInventoryHealth } from "@/hooks/inventory/use-inventory-health";
import type { FetchError } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";

function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

function HealthMetricCard({
  title,
  value,
  description,
  icon: Icon,
  variant = "default",
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "warning" | "danger";
}) {
  const variantStyles = {
    default: "border-border/50 bg-card/50",
    warning: "border-yellow-500/50 bg-yellow-500/10",
    danger: "border-destructive/50 bg-destructive/10",
  };

  return (
    <Card className={`rounded-xl ${variantStyles[variant]}`}>
      <CardHeader className="p-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-2xl font-semibold mb-1">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function InventoryHealthPageClient() {
  const { data, isLoading, error, refetch } = useInventoryHealth();
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: [endpoints.inventory.health],
    });
    refetch();
  };

  return (
    <AdminPageLayout
      title="Inventory Health"
      description="Monitor inventory health metrics and stock levels"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          className="text-xs"
        >
          <RefreshCw
            className={`mr-2 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      }
    >
      {error && (
        <ErrorDisplay
          error={error as FetchError}
          onRetry={handleRefresh}
          className="mb-4"
        />
      )}

      <QueryState
        isLoading={isLoading}
        error={error}
        data={data}
        loadingComponent={
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Card key={`skeleton-${i}`} className="rounded-xl border-border/50 bg-card/50">
                <CardHeader className="p-4">
                  <div className="h-4 w-24 bg-muted/30 rounded animate-pulse" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="h-8 w-32 bg-muted/30 rounded animate-pulse mb-2" />
                  <div className="h-3 w-48 bg-muted/30 rounded animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        }
        emptyComponent={
          <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium mb-1">No inventory health data</p>
            <p className="text-xs">Unable to load inventory health metrics</p>
          </div>
        }
      >
        {data && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <HealthMetricCard
                title="Total Stock"
                value={formatNumber(data.totalStock)}
                description="Total inventory across all variants"
                icon={Package}
              />
              <HealthMetricCard
                title="Available Stock"
                value={formatNumber(data.availableStock)}
                description="Available for sale"
                icon={Package}
              />
              <HealthMetricCard
                title="Low Stock Items"
                value={data.lowStockCount}
                description="Variants below threshold"
                icon={AlertTriangle}
                variant={data.lowStockCount > 0 ? "warning" : "default"}
              />
              <HealthMetricCard
                title="Out of Stock"
                value={data.outOfStockCount}
                description="Variants with zero stock"
                icon={AlertTriangle}
                variant={data.outOfStockCount > 0 ? "danger" : "default"}
              />
            </div>

            {/* Committed Stock Info */}
            {data.committedStock > 0 && (
              <Card className="rounded-xl border-border/50 bg-card/50">
                <CardHeader className="p-4">
                  <CardTitle className="text-sm">Committed Stock</CardTitle>
                  <CardDescription className="text-xs">
                    Stock reserved for pending orders and carts
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-semibold">
                    {formatNumber(data.committedStock)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.totalStock > 0
                      ? `${Math.round(
                          (data.committedStock / data.totalStock) * 100,
                        )}% of total stock`
                      : "No stock committed"}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Fastest Moving SKUs */}
            {data.fastestMovingSkus && data.fastestMovingSkus.length > 0 && (
              <Card className="rounded-xl border-border/50 bg-card/50">
                <CardHeader className="p-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    <CardTitle className="text-sm">
                      Fastest Moving SKUs
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Top 10 SKUs by sales volume
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="rounded-lg border border-border/50 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="group hover:bg-muted/30 transition-colors">
                          <TableHead className="text-xs">SKU</TableHead>
                          <TableHead className="text-xs">Product</TableHead>
                          <TableHead className="text-xs text-right">
                            Quantity Sold
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.fastestMovingSkus.map((sku, index) => (
                          <TableRow
                            key={sku.variantId}
                            className="group hover:bg-muted/30 transition-colors"
                          >
                            <TableCell className="text-xs font-medium">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-medium"
                                >
                                  #{index + 1}
                                </Badge>
                                {sku.sku}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {sku.productTitle}
                            </TableCell>
                            <TableCell className="text-xs text-right font-medium">
                              {formatNumber(sku.quantity)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Slowest Moving SKUs */}
            {data.slowestMovingSkus && data.slowestMovingSkus.length > 0 && (
              <Card className="rounded-xl border-border/50 bg-card/50">
                <CardHeader className="p-4">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    <CardTitle className="text-sm">
                      Slowest Moving SKUs
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Bottom 10 SKUs by sales volume
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="rounded-lg border border-border/50 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="group hover:bg-muted/30 transition-colors">
                          <TableHead className="text-xs">SKU</TableHead>
                          <TableHead className="text-xs">Product</TableHead>
                          <TableHead className="text-xs text-right">
                            Quantity Sold
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.slowestMovingSkus.map((sku, index) => (
                          <TableRow
                            key={sku.variantId}
                            className="group hover:bg-muted/30 transition-colors"
                          >
                            <TableCell className="text-xs font-medium">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-medium"
                                >
                                  #{index + 1}
                                </Badge>
                                {sku.sku}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {sku.productTitle}
                            </TableCell>
                            <TableCell className="text-xs text-right font-medium">
                              {formatNumber(sku.quantity)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty State for SKU Lists */}
            {(!data.fastestMovingSkus || data.fastestMovingSkus.length === 0) &&
              (!data.slowestMovingSkus ||
                data.slowestMovingSkus.length === 0) && (
                <Card className="rounded-xl border-border/50 bg-card/50">
                  <CardContent className="p-8 text-center">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-xs text-muted-foreground">
                      No SKU movement data available
                    </p>
                  </CardContent>
                </Card>
              )}
          </div>
        )}
      </QueryState>
    </AdminPageLayout>
  );
}
