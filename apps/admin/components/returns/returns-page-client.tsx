"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import {
  type Column,
  DataTable,
  type RowAction,
} from "@/components/common/data-table";
import { QueryState } from "@/components/common/query-state";
import { ListLayout } from "@/components/layout/list-layout";
import { Badge } from "@/components/ui/badge";
import type { ReturnRequest } from "@/hooks/returns/use-returns";
import {
  useApproveReturn,
  useRejectReturn,
  useReturns,
} from "@/hooks/returns/use-returns";

const STATUS_COLORS: Record<ReturnRequest["status"], string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-800",
  in_transit: "bg-purple-100 text-purple-800",
  received: "bg-green-100 text-green-800",
  processing_refund: "bg-orange-100 text-orange-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-gray-100 text-gray-800",
};

function ReturnStatusBadge({ status }: { status: ReturnRequest["status"] }) {
  return (
    <Badge className={STATUS_COLORS[status] || "bg-gray-100 text-gray-800"}>
      {status.replace(/_/g, " ").toUpperCase()}
    </Badge>
  );
}

export function ReturnsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    searchParams.get("status") || undefined,
  );

  const {
    data: returns,
    isLoading,
    error,
  } = useReturns({
    status: statusFilter,
  });

  const approveReturn = useApproveReturn();
  const rejectReturn = useRejectReturn();

  const handleViewDetails = useCallback(
    (returnId: string) => {
      router.push(`/returns/${returnId}`);
    },
    [router],
  );

  const handleApprove = useCallback(
    async (returnId: string) => {
      await approveReturn.mutateAsync({
        returnId,
        data: {},
      });
    },
    [approveReturn],
  );

  const handleReject = useCallback(
    async (returnId: string, reason: string) => {
      await rejectReturn.mutateAsync({
        returnId,
        reason: reason || "Rejected by admin",
      });
    },
    [rejectReturn],
  );

  const columns: Column<ReturnRequest>[] = [
    {
      id: "rmaNumber",
      header: "RMA Number",
      cell: (returnRequest) => (
        <span className="font-medium">{returnRequest.rmaNumber}</span>
      ),
    },
    {
      id: "orderId",
      header: "Order ID",
      cell: (returnRequest) => (
        <button
          type="button"
          onClick={() => router.push(`/orders/${returnRequest.orderId}`)}
          className="text-blue-600 hover:underline"
        >
          {returnRequest.orderId.substring(0, 8)}...
        </button>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (returnRequest) => (
        <ReturnStatusBadge status={returnRequest.status} />
      ),
    },
    {
      id: "reason",
      header: "Reason",
      cell: (returnRequest) => (
        <span className="text-sm">{returnRequest.reason}</span>
      ),
    },
    {
      id: "items",
      header: "Items",
      cell: (returnRequest) => (
        <span className="text-sm">{returnRequest.items.length} item(s)</span>
      ),
    },
    {
      id: "requestedAt",
      header: "Requested",
      cell: (returnRequest) => (
        <span className="text-sm">
          {new Date(returnRequest.requestedAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  const rowActions: RowAction<ReturnRequest>[] = [
    {
      label: "View Details",
      onClick: (returnRequest) => handleViewDetails(returnRequest.id),
    },
    {
      label: "Approve",
      onClick: (returnRequest) => handleApprove(returnRequest.id),
      disabled: (returnRequest) => returnRequest.status !== "pending",
    },
    {
      label: "Reject",
      onClick: (returnRequest) =>
        handleReject(returnRequest.id, "Rejected by admin"),
      disabled: (returnRequest) => returnRequest.status !== "pending",
    },
  ];

  return (
    <ListLayout
      title="Returns"
      description="Manage return requests and refunds"
    >
      <div className="flex gap-2 mb-4">
        <select
          value={statusFilter || ""}
          onChange={(e) => setStatusFilter(e.target.value || undefined)}
          className="rounded border p-2"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="in_transit">In Transit</option>
          <option value="received">Received</option>
          <option value="processing_refund">Processing Refund</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      <QueryState
        isLoading={isLoading}
        error={error}
        data={returns}
        isEmpty={(data) => !data || data.length === 0}
        emptyComponent={<div>No return requests found</div>}
      >
        {returns && (
          <DataTable data={returns} columns={columns} rowActions={rowActions} />
        )}
      </QueryState>
    </ListLayout>
  );
}
