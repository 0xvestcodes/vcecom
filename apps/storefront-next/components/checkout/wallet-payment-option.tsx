"use client";

import { Gift, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";

interface WalletPaymentOptionProps {
  checkoutSessionId: string;
  orderTotal: number;
  onWalletChange: (amount: number) => void;
  onPointsChange: (points: number) => void;
}

interface WalletBalance {
  walletBalance: number;
  loyaltyPoints: number;
}

export function WalletPaymentOption({
  orderTotal,
  onWalletChange,
  onPointsChange,
}: WalletPaymentOptionProps) {
  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(
    null,
  );
  const [useWallet, setUseWallet] = useState(false);
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWalletBalance() {
      try {
        const response = await fetch("/api/wallet/balance");
        if (response.ok) {
          const data = await response.json();
          setWalletBalance(data);
        }
      } catch (error) {
        console.error("Failed to fetch wallet balance:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchWalletBalance();
  }, []);

  useEffect(() => {
    if (useWallet && walletBalance) {
      const walletAmount = Math.min(walletBalance.walletBalance, orderTotal);
      onWalletChange(walletAmount);
    } else {
      onWalletChange(0);
    }
  }, [useWallet, walletBalance, orderTotal, onWalletChange]);

  useEffect(() => {
    if (usePoints && pointsToRedeem && walletBalance) {
      const points = parseInt(pointsToRedeem, 10) || 0;
      const maxPoints = Math.min(points, walletBalance.loyaltyPoints);
      onPointsChange(maxPoints);
    } else {
      onPointsChange(0);
    }
  }, [usePoints, pointsToRedeem, walletBalance, onPointsChange]);

  if (loading) {
    return null;
  }

  if (
    !walletBalance ||
    (walletBalance.walletBalance === 0 && walletBalance.loyaltyPoints === 0)
  ) {
    return null;
  }

  const walletAmount = useWallet
    ? Math.min(walletBalance.walletBalance, orderTotal)
    : 0;
  const pointsAmount =
    usePoints && pointsToRedeem
      ? (parseInt(pointsToRedeem, 10) || 0) * 0.01 // Assuming 1 point = ₹0.01, adjust based on your redemption rate
      : 0;
  const remainingTotal = orderTotal - walletAmount - pointsAmount;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallet & Loyalty Points</CardTitle>
        <CardDescription>
          Use your wallet balance or redeem loyalty points
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {walletBalance.walletBalance > 0 && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="use-wallet"
              checked={useWallet}
              onCheckedChange={(checked) => setUseWallet(checked === true)}
            />
            <Label
              htmlFor="use-wallet"
              className="flex-1 cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center space-x-2">
                <Wallet className="h-4 w-4" />
                <span>Use Wallet Balance</span>
              </div>
              <span className="text-sm text-muted-foreground">
                Available: {formatCurrency(walletBalance.walletBalance)}
              </span>
            </Label>
          </div>
        )}

        {useWallet && walletAmount > 0 && (
          <div className="ml-6 p-3 bg-muted rounded-md">
            <p className="text-sm">
              Using {formatCurrency(walletAmount)} from wallet
            </p>
          </div>
        )}

        {walletBalance.loyaltyPoints > 0 && (
          <>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="use-points"
                checked={usePoints}
                onCheckedChange={(checked) => setUsePoints(checked === true)}
              />
              <Label
                htmlFor="use-points"
                className="flex-1 cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <Gift className="h-4 w-4" />
                  <span>Redeem Loyalty Points</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  Available: {walletBalance.loyaltyPoints.toLocaleString()} pts
                </span>
              </Label>
            </div>

            {usePoints && (
              <div className="ml-6 space-y-2">
                <Label htmlFor="points-amount">Points to Redeem</Label>
                <Input
                  id="points-amount"
                  type="number"
                  min="0"
                  max={walletBalance.loyaltyPoints}
                  value={pointsToRedeem}
                  onChange={(e) => setPointsToRedeem(e.target.value)}
                  placeholder="Enter points"
                />
                {pointsToRedeem && (
                  <p className="text-xs text-muted-foreground">
                    ≈{" "}
                    {formatCurrency((parseInt(pointsToRedeem, 10) || 0) * 0.01)}{" "}
                    discount
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {(walletAmount > 0 || pointsAmount > 0) && (
          <div className="pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span>Order Total</span>
              <span>{formatCurrency(orderTotal)}</span>
            </div>
            {walletAmount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Wallet Discount</span>
                <span>-{formatCurrency(walletAmount)}</span>
              </div>
            )}
            {pointsAmount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Points Discount</span>
                <span>-{formatCurrency(pointsAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold pt-2 border-t">
              <span>Remaining Total</span>
              <span>{formatCurrency(Math.max(0, remainingTotal))}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
