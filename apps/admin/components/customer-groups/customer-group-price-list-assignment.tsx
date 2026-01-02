"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useAdminAssignPriceList } from "@/hooks/customer-groups/use-admin-assign-price-list";
import { useAdminPriceLists } from "@/hooks/pricing/use-admin-price-lists";
import type { CustomerGroupPriceList } from "@/lib/types/customer-groups";
import type { PriceList } from "@/lib/types/price-lists";

interface CustomerGroupPriceListAssignmentProps {
  groupId: string;
  priceLists: CustomerGroupPriceList[];
  onPriceListRemoved: (priceListId: string) => void;
}

export function CustomerGroupPriceListAssignment({
  groupId,
  priceLists,
  onPriceListRemoved,
}: CustomerGroupPriceListAssignmentProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPriceListId, setSelectedPriceListId] = useState<string>("");
  const [priority, setPriority] = useState<number>(1);

  const { data: availablePriceListsResponse } = useAdminPriceLists();
  const availablePriceLists = availablePriceListsResponse?.data || [];
  const assignPriceList = useAdminAssignPriceList(groupId);

  // Filter out already assigned price lists
  const assignedIds = new Set(priceLists.map((pl) => pl.id));
  const available = availablePriceLists.filter(
    (pl: PriceList) => !assignedIds.has(pl.id),
  );

  const handleAssign = async () => {
    if (!selectedPriceListId) return;

    try {
      await assignPriceList.mutateAsync({
        priceListId: selectedPriceListId,
        priority,
      });
      setDialogOpen(false);
      setSelectedPriceListId("");
      setPriority(1);
    } catch (_error) {
      // Error handled by hook
    }
  };

  const handleRemove = async (priceListId: string) => {
    if (confirm("Remove this price list from the group?")) {
      try {
        await onPriceListRemoved(priceListId);
      } catch (_error) {
        // Error handled by parent
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Assigned Price Lists</h3>
          <p className="text-sm text-muted-foreground">
            Price lists assigned to this customer group
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Assign Price List
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Price List</DialogTitle>
              <DialogDescription>
                Select a price list to assign to this customer group
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Price List</Label>
                <Select
                  value={selectedPriceListId}
                  onValueChange={setSelectedPriceListId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a price list" />
                  </SelectTrigger>
                  <SelectContent>
                    {available.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No price lists available
                      </SelectItem>
                    ) : (
                      available.map((pl) => (
                        <SelectItem key={pl.id} value={pl.id}>
                          {pl.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input
                  type="number"
                  min="1"
                  value={priority}
                  onChange={(e) =>
                    setPriority(parseInt(e.target.value, 10) || 1)
                  }
                  placeholder="1"
                />
                <p className="text-xs text-muted-foreground">
                  Higher priority price lists are applied first
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAssign}
                disabled={!selectedPriceListId || assignPriceList.isPending}
              >
                {assignPriceList.isPending ? "Assigning..." : "Assign"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {priceLists.length === 0 ? (
        <div className="text-center py-8 border rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground mb-4">
            No price lists assigned. Click "Assign Price List" to add one.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {priceLists.map((pl) => (
            <div
              key={pl.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium">{pl.name}</span>
                <Badge variant="secondary">Priority: {pl.priority}</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(pl.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
