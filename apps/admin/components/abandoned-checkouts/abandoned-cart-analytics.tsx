"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAbandonedCartAnalytics } from "@/hooks/abandoned-checkouts/use-abandoned-cart-analytics";
import { useAbandonedCartStats } from "@/hooks/abandoned-checkouts/use-abandoned-cart-stats";
import { formatCurrency } from "@/lib/utils";

export function AbandonedCartAnalytics() {
  const [dateRange, setDateRange] = useState<{
    startDate?: string;
    endDate?: string;
  }>({});

  const { data: stats, isLoading: statsLoading } = useAbandonedCartStats();
  const { data: analytics, isLoading: analyticsLoading } =
    useAbandonedCartAnalytics(dateRange);

  const isLoading = statsLoading || analyticsLoading;

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Abandoned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : stats?.totalAbandoned || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Carts detected as abandoned
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recovery Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : `${(stats?.recoveryRate || 0).toFixed(1)}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.totalRecovered || 0} of {stats?.totalAbandoned || 0}{" "}
              recovered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Revenue Recovered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading
                ? "..."
                : formatCurrency(stats?.totalRevenueRecovered || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              From recovered carts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Average Cart Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : formatCurrency(stats?.averageCartValue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Average abandoned cart value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Recovery Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading
                ? "..."
                : `${(stats?.averageRecoveryTime || 0).toFixed(1)}h`}
            </div>
            <p className="text-xs text-muted-foreground">
              Average time to recover
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Date Range Filter</CardTitle>
          <CardDescription>
            Filter analytics by date range (optional)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label
                htmlFor="start-date"
                className="text-sm font-medium mb-2 block"
              >
                Start Date
              </label>
              <Input
                id="start-date"
                type="date"
                value={dateRange.startDate || ""}
                onChange={(e) =>
                  setDateRange((prev) => ({
                    ...prev,
                    startDate: e.target.value || undefined,
                  }))
                }
              />
            </div>
            <div className="flex-1">
              <label
                htmlFor="end-date"
                className="text-sm font-medium mb-2 block"
              >
                End Date
              </label>
              <Input
                id="end-date"
                type="date"
                value={dateRange.endDate || ""}
                onChange={(e) =>
                  setDateRange((prev) => ({
                    ...prev,
                    endDate: e.target.value || undefined,
                  }))
                }
              />
            </div>
            <Button variant="outline" onClick={() => setDateRange({})}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recovery Attempts Breakdown */}
      {analytics && (
        <Card>
          <CardHeader>
            <CardTitle>Recovery Attempts Breakdown</CardTitle>
            <CardDescription>
              Distribution of recovery attempt statuses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {analytics.recoveryAttemptsBreakdown.emailSent}
                </div>
                <div className="text-sm text-muted-foreground">Email Sent</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {analytics.recoveryAttemptsBreakdown.smsSent}
                </div>
                <div className="text-sm text-muted-foreground">SMS Sent</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-emerald-600">
                  {analytics.recoveryAttemptsBreakdown.recovered}
                </div>
                <div className="text-sm text-muted-foreground">Recovered</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-gray-600">
                  {analytics.recoveryAttemptsBreakdown.expired}
                </div>
                <div className="text-sm text-muted-foreground">Expired</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {analytics.recoveryAttemptsBreakdown.failed}
                </div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Abandoned Products */}
      {analytics && analytics.topAbandonedProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Abandoned Products</CardTitle>
            <CardDescription>
              Products most frequently abandoned in carts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Abandon Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.topAbandonedProducts.map((product) => (
                  <TableRow key={product.productId}>
                    <TableCell className="font-medium">
                      {product.productName}
                    </TableCell>
                    <TableCell className="text-right">
                      {product.abandonCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Abandoned Over Time */}
      {analytics && analytics.abandonedOverTime.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Abandoned Carts Over Time</CardTitle>
            <CardDescription>
              Daily breakdown of abandoned carts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {analytics.abandonedOverTime.map((item) => (
                <div
                  key={item.date}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <div className="font-medium">{item.date}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.count} carts
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {formatCurrency(item.totalValue)}
                    </div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
