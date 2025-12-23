"use client";

import { Check, Trash2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PaginationControls } from "@/components/common/pagination-controls";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { DateTime } from "@/components/orders/date-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorDisplay } from "@/components/ui/error-display";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminApproveReview } from "@/hooks/reviews/use-admin-approve-review";
import { useAdminDeleteReview } from "@/hooks/reviews/use-admin-delete-review";
import { useAdminPendingReviews } from "@/hooks/reviews/use-admin-pending-reviews";
import { useAdminRejectReview } from "@/hooks/reviews/use-admin-reject-review";
import type { FetchError } from "@/lib/api";

export function ReviewsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(
    parseInt(searchParams.get("page") || "1", 10),
  );
  const [limit] = useState(20);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);
  const [processingReviewId, setProcessingReviewId] = useState<string | null>(
    null,
  );

  const { data, isLoading, error, refetch } = useAdminPendingReviews(
    page,
    limit,
  );
  const approveReview = useAdminApproveReview();
  const rejectReview = useAdminRejectReview();
  const deleteReview = useAdminDeleteReview();

  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", page.toString());
    router.replace(`/reviews?${params.toString()}`, { scroll: false });
  }, [page, router]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const paginationInfo = data
    ? {
        startItem: (data.page - 1) * data.limit + 1,
        endItem: Math.min(data.page * data.limit, data.total),
        total: data.total,
        currentPage: data.page,
        totalPages: data.totalPages,
      }
    : null;

  const handleApprove = async (reviewId: string) => {
    setProcessingReviewId(reviewId);
    try {
      await approveReview.mutateAsync(reviewId);
    } catch (_error) {
      // Error already handled by hook
    } finally {
      setProcessingReviewId(null);
    }
  };

  const handleReject = async (reviewId: string) => {
    setProcessingReviewId(reviewId);
    try {
      await rejectReview.mutateAsync(reviewId);
    } catch (_error) {
      // Error already handled by hook
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
      await deleteReview.mutateAsync(reviewToDelete);
      setDeleteDialogOpen(false);
      setReviewToDelete(null);
    }
  };

  return (
    <AdminPageLayout
      title="Reviews"
      description="Moderate product reviews"
      pagination={
        <PaginationControls
          paginationInfo={paginationInfo}
          onPreviousPage={() => handlePageChange(page - 1)}
          onNextPage={() => handlePageChange(page + 1)}
          canGoPrevious={data ? data.page > 1 : false}
          canGoNext={data ? data.page < data.totalPages : false}
          isLoading={isLoading}
          itemLabel="reviews"
        />
      }
    >
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Review"
        description="Are you sure you want to delete this review? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        isLoading={deleteReview.isPending}
      />

      {error && (
        <ErrorDisplay
          error={error as FetchError}
          onRetry={() => refetch()}
          className="mb-4"
        />
      )}

      {isLoading ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rating</TableHead>
                <TableHead>Review</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[200px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }, (_, i) => (
                <TableRow key={`skeleton-row-${String(i)}`}>
                  <TableCell className="h-12 animate-pulse bg-muted" />
                  <TableCell className="h-12 animate-pulse bg-muted" />
                  <TableCell className="h-12 animate-pulse bg-muted" />
                  <TableCell className="h-12 animate-pulse bg-muted" />
                  <TableCell className="h-12 animate-pulse bg-muted" />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : data && data.data.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-lg font-medium mb-2">No pending reviews</p>
          <p className="text-sm">All reviews have been moderated</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rating</TableHead>
                <TableHead>Review</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[200px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data.map((review) => (
                <TableRow key={review.id}>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <span
                          key={`star-${String(i)}`}
                          className={
                            i < review.rating
                              ? "text-yellow-500"
                              : "text-gray-300"
                          }
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      {review.title && (
                        <p className="font-medium">{review.title}</p>
                      )}
                      {review.comment && (
                        <p className="text-sm text-muted-foreground">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        review.status === "approved"
                          ? "default"
                          : review.status === "rejected"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {review.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DateTime date={review.createdAt} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApprove(review.id)}
                        disabled={
                          processingReviewId !== null || deleteReview.isPending
                        }
                        title="Approve review"
                      >
                        {processingReviewId === review.id &&
                        approveReview.isPending ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(review.id)}
                        disabled={
                          processingReviewId !== null || deleteReview.isPending
                        }
                        title="Reject review"
                      >
                        {processingReviewId === review.id &&
                        rejectReview.isPending ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteClick(review.id)}
                        disabled={
                          processingReviewId !== null || deleteReview.isPending
                        }
                        title="Delete review"
                      >
                        {deleteReview.isPending &&
                        reviewToDelete === review.id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AdminPageLayout>
  );
}
