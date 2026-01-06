"use client";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useFraudRiskScore } from "@/hooks/fraud-detection/use-fraud-flagged-orders";
import { DateTime } from "../orders/date-time";

interface RiskScoreDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
}

export function RiskScoreDetailsDialog({
  open,
  onOpenChange,
  orderId,
}: RiskScoreDetailsDialogProps) {
  const { data: riskScore, isLoading } = useFraudRiskScore(orderId || "");

  const getRiskLevel = (score: number) => {
    if (score >= 70) return { level: "High", color: "destructive" };
    if (score >= 40) return { level: "Medium", color: "secondary" };
    return { level: "Low", color: "outline" };
  };

  const formatRiskFactors = (
    factors: Record<string, boolean> | null | undefined,
  ) => {
    if (!factors) return [];

    return Object.entries(factors)
      .filter(([_, value]) => value === true)
      .map(([key, _]) => key);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Risk Score Details</DialogTitle>
          <DialogDescription>
            Detailed risk assessment for order {orderId}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : riskScore ? (
          <div className="space-y-6">
            {/* Risk Score Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Risk Score
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold">
                    {riskScore.riskScore}
                  </span>
                  <Badge
                    variant={
                      (getRiskLevel(riskScore.riskScore).color as
                        | "default"
                        | "secondary"
                        | "destructive"
                        | "outline") || "outline"
                    }
                  >
                    {getRiskLevel(riskScore.riskScore).level} Risk
                  </Badge>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Status
                </div>
                <div className="mt-1">
                  <Badge
                    variant={riskScore.flagged ? "destructive" : "secondary"}
                  >
                    {riskScore.flagged ? "Flagged" : "Not Flagged"}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* Risk Factors */}
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-3 block">
                Risk Factors Detected
              </div>
              <div className="grid grid-cols-2 gap-2">
                {formatRiskFactors(riskScore.riskFactors).map((factor) => (
                  <Badge
                    key={factor}
                    variant="outline"
                    className="justify-start"
                  >
                    {factor.replace(/([A-Z])/g, " $1").toLowerCase()}
                  </Badge>
                ))}
                {formatRiskFactors(riskScore.riskFactors).length === 0 && (
                  <span className="text-sm text-muted-foreground col-span-2">
                    No risk factors detected
                  </span>
                )}
              </div>
            </div>

            {/* Review Information */}
            {riskScore.reviewedAt && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Review Information
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Reviewed by:</span>{" "}
                      {riskScore.reviewedBy || "Unknown"}
                    </div>
                    <div>
                      <span className="font-medium">Reviewed at:</span>{" "}
                      <DateTime date={riskScore.reviewedAt} />
                    </div>
                  </div>
                  {riskScore.reviewNotes && (
                    <div>
                      <span className="font-medium">Notes:</span>{" "}
                      <p className="text-sm mt-1">{riskScore.reviewNotes}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Timestamps */}
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div>
                <span className="font-medium">Created:</span>{" "}
                <DateTime date={riskScore.createdAt} />
              </div>
              <div>
                <span className="font-medium">Updated:</span>{" "}
                <DateTime date={riskScore.updatedAt} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <span className="text-muted-foreground">
              No risk score data found
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
