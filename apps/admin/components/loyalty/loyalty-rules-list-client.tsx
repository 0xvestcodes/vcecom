"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { type Column, DataTable } from "@/components/common/data-table";
import { QueryState } from "@/components/common/query-state";
import { ListLayout } from "@/components/layout/list-layout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type LoyaltyRule,
  useCreateLoyaltyRule,
  useDeleteLoyaltyRule,
  useLoyaltyRules,
} from "@/hooks/loyalty/use-loyalty-rules";

export function LoyaltyRulesListClient() {
  const _router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<
    "earning" | "redemption" | "all"
  >("all");

  const {
    data: rules,
    isLoading,
    error,
  } = useLoyaltyRules(typeFilter !== "all" ? { type: typeFilter } : undefined);
  const createRule = useCreateLoyaltyRule();
  const deleteRule = useDeleteLoyaltyRule();

  const [formData, setFormData] = useState({
    name: "",
    type: "earning" as "earning" | "redemption",
    ruleType: "percentage" as "percentage" | "fixed" | "tiered",
    pointsPerRupee: "",
    rupeesPerPoint: "",
    minOrderValue: "",
    minPointsToRedeem: "",
    maxPointsPerOrder: "",
  });

  const handleCreate = () => {
    if (!formData.name) {
      toast.error("Rule name is required");
      return;
    }

    createRule.mutate(
      {
        name: formData.name,
        type: formData.type,
        ruleType: formData.ruleType,
        pointsPerRupee: formData.pointsPerRupee
          ? parseFloat(formData.pointsPerRupee)
          : undefined,
        rupeesPerPoint: formData.rupeesPerPoint
          ? parseFloat(formData.rupeesPerPoint)
          : undefined,
        minOrderValue: formData.minOrderValue
          ? parseFloat(formData.minOrderValue)
          : undefined,
        minPointsToRedeem: formData.minPointsToRedeem
          ? parseInt(formData.minPointsToRedeem, 10)
          : undefined,
        maxPointsPerOrder: formData.maxPointsPerOrder
          ? parseInt(formData.maxPointsPerOrder, 10)
          : undefined,
      },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setFormData({
            name: "",
            type: "earning",
            ruleType: "percentage",
            pointsPerRupee: "",
            rupeesPerPoint: "",
            minOrderValue: "",
            minPointsToRedeem: "",
            maxPointsPerOrder: "",
          });
        },
      },
    );
  };

  const handleDelete = (ruleId: string) => {
    if (confirm("Are you sure you want to delete this rule?")) {
      deleteRule.mutate(ruleId);
    }
  };

  const columns: Column<LoyaltyRule>[] = [
    {
      id: "name",
      header: "Name",
      cell: (rule) => rule.name,
    },
    {
      id: "type",
      header: "Type",
      cell: (rule) => <span className="capitalize">{rule.type}</span>,
    },
    {
      id: "ruleType",
      header: "Calculation",
      cell: (rule) => <span className="capitalize">{rule.ruleType}</span>,
    },
    {
      id: "pointsPerRupee",
      header: "Points/Rupee",
      cell: (rule) =>
        rule.type === "earning" ? rule.pointsPerRupee.toFixed(4) : "-",
    },
    {
      id: "rupeesPerPoint",
      header: "Rupees/Point",
      cell: (rule) =>
        rule.type === "redemption" ? rule.rupeesPerPoint.toFixed(4) : "-",
    },
    {
      id: "isActive",
      header: "Status",
      cell: (rule) => (
        <span
          className={
            rule.isActive ? "text-green-600 font-medium" : "text-gray-500"
          }
        >
          {rule.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: (rule) => (
        <Button variant="ghost" size="sm" onClick={() => handleDelete(rule.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <>
      <ListLayout
        title="Loyalty Rules"
        description="Manage earning and redemption rules for loyalty points"
        createButtonLabel="Create Rule"
        onCreateClick={() => setCreateOpen(true)}
      >
        <div className="mb-4">
          <Select
            value={typeFilter}
            onValueChange={(value) =>
              setTypeFilter(value as "earning" | "redemption" | "all")
            }
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rules</SelectItem>
              <SelectItem value="earning">Earning Rules</SelectItem>
              <SelectItem value="redemption">Redemption Rules</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <QueryState
          isLoading={isLoading}
          error={error}
          data={rules}
          loadingComponent={<div>Loading...</div>}
          emptyComponent={<div>No loyalty rules found</div>}
          onRetry={() => window.location.reload()}
        >
          {rules && (
            <DataTable<LoyaltyRule>
              columns={columns}
              data={rules}
              emptyMessage="No loyalty rules found"
              isLoading={isLoading}
            />
          )}
        </QueryState>
      </ListLayout>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Loyalty Rule</DialogTitle>
            <DialogDescription>
              Configure how customers earn or redeem loyalty points
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Rule Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Standard Earning Rate"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Rule Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      type: value as "earning" | "redemption",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="earning">Earning</SelectItem>
                    <SelectItem value="redemption">Redemption</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="ruleType">Calculation Type</Label>
                <Select
                  value={formData.ruleType}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      ruleType: value as "percentage" | "fixed" | "tiered",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="tiered">Tiered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.type === "earning" && (
              <div>
                <Label htmlFor="pointsPerRupee">
                  Points per Rupee (e.g., 0.01 = 1 point per ₹100)
                </Label>
                <Input
                  id="pointsPerRupee"
                  type="number"
                  step="0.0001"
                  value={formData.pointsPerRupee}
                  onChange={(e) =>
                    setFormData({ ...formData, pointsPerRupee: e.target.value })
                  }
                />
              </div>
            )}

            {formData.type === "redemption" && (
              <>
                <div>
                  <Label htmlFor="rupeesPerPoint">
                    Rupees per Point (e.g., 0.01 = ₹1 per 100 points)
                  </Label>
                  <Input
                    id="rupeesPerPoint"
                    type="number"
                    step="0.0001"
                    value={formData.rupeesPerPoint}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rupeesPerPoint: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="minPointsToRedeem">
                    Minimum Points to Redeem
                  </Label>
                  <Input
                    id="minPointsToRedeem"
                    type="number"
                    value={formData.minPointsToRedeem}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minPointsToRedeem: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="maxPointsPerOrder">
                    Max Points per Order (optional)
                  </Label>
                  <Input
                    id="maxPointsPerOrder"
                    type="number"
                    value={formData.maxPointsPerOrder}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxPointsPerOrder: e.target.value,
                      })
                    }
                  />
                </div>
              </>
            )}

            <div>
              <Label htmlFor="minOrderValue">Minimum Order Value</Label>
              <Input
                id="minOrderValue"
                type="number"
                step="0.01"
                value={formData.minOrderValue}
                onChange={(e) =>
                  setFormData({ ...formData, minOrderValue: e.target.value })
                }
              />
            </div>

            <Button
              onClick={handleCreate}
              disabled={createRule.isPending}
              className="w-full"
            >
              {createRule.isPending ? "Creating..." : "Create Rule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
