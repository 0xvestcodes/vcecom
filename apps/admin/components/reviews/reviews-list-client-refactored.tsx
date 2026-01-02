"use client";

import { Check, Star, Trash2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  type Column,
  DataTable,
  type RowAction,
} from "@/components/common/data-table";
import { ProtectedButton } from "@/components/common/protected-button";
import { QueryState } from "@/components/common/query-state";
import { ListLayout } from "@/components/layout/list-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAdminApproveReview } from "@/hooks/reviews/use-admin-approve-review";
import { useAdminDeleteReview } from "@/hooks/reviews/use-admin-delete-review";
import { useAdminPendingReviews } from "@/hooks/reviews/use-admin-pending-reviews";
import { useAdminRejectReview } from "@/hooks/reviews/use-admin-reject-review";
import { usePagination } from "@/hooks/use-pagination";
import type { Review } from "@/lib/types/reviews";
import { PaginationControls } from "../common/pagination-controls";
import { DateTime } from "../orders/date-time";
import { EmptyReviewsState } from "./empty-reviews-state";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/**
 * Refactored Reviews List Client using universal components (L1 pattern)
 * Reviews only needs list page - no detail page needed
 */
export function ReviewsListClientRefactored() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);
  const [processingReviewId, setProcessingReviewId] = useState<string | null>(
    null,
  );

  const initialPage = parseInt(
    searchParams.get("page") || String(DEFAULT_PAGE),
    10,
  );
  const [page, setPage] = useState(initialPage);
  const [limit] = useState(DEFAULT_LIMIT);

  const {
    data: reviewsData,
    isLoading,
    error,
    refetch,
  } = useAdminPendingReviews(page, limit);

  const approveReview = useAdminApproveReview();
  const rejectReview = useAdminRejectReview();
  const deleteReview = useAdminDeleteReview();

  useSyncPageToUrl(page, router);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const paginationData = reviewsData
    ? {
        page: reviewsData.page,
        limit: reviewsData.limit,
        total: reviewsData.total,
        totalPages: reviewsData.totalPages,
        hasNextPage: reviewsData.page < reviewsData.totalPages,
        hasPreviousPage: reviewsData.page > 1,
      }
    : undefined;

  const pagination = usePagination(paginationData, handlePageChange);

  const handleApprove = async (reviewId: string) => {
    setProcessingReviewId(reviewId);
    try {
      await approveReview.mutateAsync(reviewId);
      toast.success("Review approved successfully");
    } catch (_error) {
      // Error handled by hook
    } finally {
      setProcessingReviewId(null);
    }
  };

  const handleReject = async (reviewId: string) => {
    setProcessingReviewId(reviewId);
    try {
      await rejectReview.mutateAsync(reviewId);
      toast.success("Review rejected successfully");
    } catch (_error) {
      // Error handled by hook
    } finally {
      setProcessingReviewId(null);
    }
  };

  const handleDeleteClick = (reviewId: string) => {
    setReviewToDelete(reviewId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (reviewToDelete) {
      try {
        await deleteReview.mutateAsync(reviewToDelete);
        toast.success("Review deleted successfully");
        setDeleteDialogOpen(false);
        setReviewToDelete(null);
      } catch (_error) {
        // Error handled by hook
      }
    }
  };

  // Convert reviews to table format
  const columns: Column<Review>[] = [
    {
      id: "product",
      header: "Product",
      cell: (review) => (
        <div>
          <div className="font-medium">{review.productTitle || "N/A"}</div>
          {review.productVariantTitle && (
            <div className="text-xs text-muted-foreground">
              {review.productVariantTitle}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "customer",
      header: "Customer",
      cell: (review) => (
        <div>
          <div className="font-medium">
            {review.customerName || "Anonymous"}
          </div>
          {review.customerEmail && (
            <div className="text-xs text-muted-foreground">
              {review.customerEmail}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "rating",
      header: "Rating",
      cell: (review) => (
        <div className="flex items-center gap-1">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          <span className="font-medium">{review.rating}</span>
        </div>
      ),
    },
    {
      id: "comment",
      header: "Comment",
      cell: (review) => (
        <div className="max-w-md">
          <p className="text-sm line-clamp-2">{review.comment || "-"}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (review) => (
        <Badge variant="outline" className="text-xs">
          {review.status}
        </Badge>
      ),
    },
    {
      id: "createdAt",
      header: "Created",
      cell: (review) => <DateTime date={review.createdAt} />,
    },
  ];

  const rowActions: RowAction<Review>[] = [
    {
      label: "Approve",
      icon: <Check className="h-4 w-4" />,
      onClick: (review) => handleApprove(review.id),
      disabled: (review) =>
        processingReviewId === review.id || review.status === "approved",
      roles: ["admin", "marketing"],
    },
    {
      label: "Reject",
      icon: <X className="h-4 w-4" />,
      onClick: (review) => handleReject(review.id),
      disabled: (review) =>
        processingReviewId === review.id || review.status === "rejected",
      roles: ["admin", "marketing"],
    },
    {
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: (review) => handleDeleteClick(review.id),
      destructive: true,
      roles: ["admin", "marketing"],
    },
  ];

  return (
    <>
      <ListLayout
        title="Reviews"
        description="Moderate product reviews"
        pagination={
          <PaginationControls
            paginationInfo={pagination.paginationInfo}
            onPreviousPage={pagination.handlePreviousPage}
            onNextPage={pagination.handleNextPage}
            canGoPrevious={pagination.canGoPrevious}
            canGoNext={pagination.canGoNext}
            isLoading={isLoading}
            itemLabel="reviews"
          />
        }
      >
        <QueryState
          isLoading={isLoading}
          error={error}
          data={reviewsData}
          loadingComponent={
            <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
          }
          emptyComponent={<EmptyReviewsState />}
          onRetry={() => refetch()}
        >
          <DataTable
            columns={columns}
            data={reviewsData?.data || []}
            rowActions={rowActions}
            emptyMessage="No reviews found"
            isLoading={isLoading}
          />
        </QueryState>
      </ListLayout>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Review"
        description="Are you sure you want to delete this review? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        isLoading={deleteReview.isPending}
      />
    </>
  );
}

/**
 * Hook to sync page to URL when it changes
 */
function useSyncPageToUrl(page: number, router: ReturnType<typeof useRouter>) {
  useEffect(() => {
    const urlParams = new URLSearchParams();

    if (page > DEFAULT_PAGE) {
      urlParams.set("page", page.toString());
    }

    router.replace(`/reviews?${urlParams.toString()}`, { scroll: false });
  }, [page, router]);
}
