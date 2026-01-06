"use client";

import { CheckCircle, Eye } from "lucide-react";
import { useCallback, useState } from "react";
import {
  type Column,
  DataTable,
  type RowAction,
} from "@/components/common/data-table";
import { QueryState } from "@/components/common/query-state";
import { ListLayout } from "@/components/layout/list-layout";
import { Badge } from "@/components/ui/badge";
import {
  useFraudFlaggedOrders,
  useReviewOrder,
} from "@/hooks/fraud-detection/use-fraud-flagged-orders";
import { FetchError } from "@/lib/api";
import type { FraudFlaggedOrderDto } from "@/lib/types/fraud-detection";
import { PaginationControls } from "../common/pagination-controls";
import { DateTime } from "../orders/date-time";
import { ReviewOrderDialog } from "./review-order-dialog";
import { RiskScoreDetailsDialog } from "./risk-score-details-dialog";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

interface FlaggedOrdersFilters {
  page: number;
  limit: number;
}

/**
 * Fraud Detection - Flagged Orders Component
 */
export function FraudFlaggedOrders() {
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FlaggedOrdersFilters>({
    page: DEFAULT_PAGE,
    limit: DEFAULT_LIMIT,
  });

  const {
    data: flaggedOrdersData,
    isLoading,
    error,
    refetch,
  } = useFraudFlaggedOrders(filters);

  const reviewOrderMutation = useReviewOrder();

  const handlePageChange = useCallback((newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  }, []);

  const handleReview = (orderId: string) => {
    setSelectedOrderId(orderId);
    setReviewDialogOpen(true);
  };

  const handleViewDetails = (orderId: string) => {
    setSelectedOrderId(orderId);
    setDetailsDialogOpen(true);
  };

  const handleReviewSubmit = async (reviewData: { notes?: string }) => {
    if (!selectedOrderId) return;

    await reviewOrderMutation.mutateAsync({
      orderId: selectedOrderId,
      reviewData,
    });

    setReviewDialogOpen(false);
    setSelectedOrderId(null);
  };

  const getRiskLevel = (score: number) => {
    if (score >= 70) return { level: "high", color: "destructive" };
    if (score >= 40) return { level: "medium", color: "secondary" };
    return { level: "low", color: "outline" };
  };

  const columns: Column<FraudFlaggedOrderDto>[] = [
    {
      id: "orderId",
      header: "Order ID",
      accessorKey: "orderId",
      cell: (row) => <span className="font-mono text-sm">{row.orderId}</span>,
    },
    {
      id: "riskScore",
      header: "Risk Score",
      accessorKey: "riskScore",
      cell: (row) => {
        const { level, color } = getRiskLevel(row.riskScore);
        return (
          <Badge
            variant={
              (color as "default" | "secondary" | "destructive" | "outline") ||
              "outline"
            }
            className="capitalize"
          >
            {level} ({row.riskScore})
          </Badge>
        );
      },
    },
    {
      id: "riskFactors",
      header: "Risk Factors",
      accessorKey: "riskFactors",
      cell: (row) => {
        if (!row.riskFactors) return "—";
        const factors = Object.keys(row.riskFactors).filter(
          (key) => row.riskFactors[key],
        );
        return factors.length > 0 ? factors.join(", ") : "—";
      },
    },
    {
      id: "reviewedAt",
      header: "Status",
      accessorKey: "reviewedAt",
      cell: (row) => (
        <Badge variant={row.reviewedAt ? "secondary" : "destructive"}>
          {row.reviewedAt ? "Reviewed" : "Pending Review"}
        </Badge>
      ),
    },
    {
      id: "createdAt",
      header: "Flagged",
      accessorKey: "createdAt",
      cell: (row) => <DateTime date={row.createdAt} />,
    },
  ];

  const rowActions: RowAction<FraudFlaggedOrderDto>[] = [
    {
      label: "View Details",
      icon: <Eye className="h-4 w-4" />,
      onClick: (row) => handleViewDetails(row.orderId),
    },
    {
      label: "Mark Reviewed",
      icon: <CheckCircle className="h-4 w-4" />,
      onClick: (row) => handleReview(row.orderId),
      disabled: (row) => !!row.reviewedAt,
    },
  ];

  const paginationData = flaggedOrdersData
    ? {
        page: flaggedOrdersData.page,
        limit: flaggedOrdersData.limit,
        total: flaggedOrdersData.total,
        totalPages: flaggedOrdersData.totalPages,
        hasNextPage: flaggedOrdersData.page < flaggedOrdersData.totalPages,
        hasPreviousPage: flaggedOrdersData.page > 1,
      }
    : undefined;

  return (
    <ListLayout
      title="Flagged Orders"
      description="Orders flagged for fraud review"
    >
      <div className="space-y-4">
        <QueryState
          isLoading={isLoading}
          error={error as FetchError | null}
          data={flaggedOrdersData}
          onRetry={refetch}
          isEmpty={(data) => !data || data.data.length === 0}
          emptyComponent={<div>No flagged orders found</div>}
        >
          <DataTable
            columns={columns}
            data={flaggedOrdersData?.data || []}
            rowActions={rowActions}
          />
        </QueryState>

        {/* Pagination */}
        {paginationData && (
          <PaginationControls
            paginationInfo={
              paginationData
                ? {
                    startItem:
                      (paginationData.page - 1) * paginationData.limit + 1,
                    endItem: Math.min(
                      paginationData.page * paginationData.limit,
                      paginationData.total,
                    ),
                    total: paginationData.total,
                    currentPage: paginationData.page,
                    totalPages: paginationData.totalPages,
                  }
                : null
            }
            onPreviousPage={() => handlePageChange(paginationData.page - 1)}
            onNextPage={() => handlePageChange(paginationData.page + 1)}
            canGoPrevious={paginationData.hasPreviousPage}
            canGoNext={paginationData.hasNextPage}
          />
        )}

        {/* Review Order Dialog */}
        <ReviewOrderDialog
          open={reviewDialogOpen}
          onOpenChange={setReviewDialogOpen}
          onSubmit={handleReviewSubmit}
          loading={reviewOrderMutation.isPending}
        />

        {/* Risk Score Details Dialog */}
        <RiskScoreDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          orderId={selectedOrderId}
        />
      </div>
    </ListLayout>
  );
}
