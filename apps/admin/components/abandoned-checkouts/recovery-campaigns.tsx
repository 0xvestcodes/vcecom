"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRecoveryCampaignStats } from "@/hooks/abandoned-checkouts/use-recovery-campaign-stats";
import { formatCurrency } from "@/lib/utils";

export function RecoveryCampaigns() {
  const { data: campaigns, isLoading } = useRecoveryCampaignStats();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recovery Campaigns</CardTitle>
          <CardDescription>Loading campaign statistics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recovery Campaigns</CardTitle>
          <CardDescription>No recovery campaigns found</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No campaigns have been run yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recovery Campaigns</CardTitle>
        <CardDescription>
          Performance metrics for recovery campaigns (last 30 days)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Total Carts</TableHead>
              <TableHead className="text-right">Emails Sent</TableHead>
              <TableHead className="text-right">SMS Sent</TableHead>
              <TableHead className="text-right">Recovered</TableHead>
              <TableHead className="text-right">Recovery Rate</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((campaign) => (
              <TableRow key={campaign.campaignId}>
                <TableCell className="font-medium">
                  {new Date(campaign.campaignId).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  {campaign.totalCarts}
                </TableCell>
                <TableCell className="text-right">
                  {campaign.emailsSent}
                </TableCell>
                <TableCell className="text-right">{campaign.smsSent}</TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700"
                  >
                    {campaign.recovered}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant={
                      campaign.recoveryRate >= 30
                        ? "default"
                        : campaign.recoveryRate >= 15
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {campaign.recoveryRate.toFixed(1)}%
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(campaign.totalRevenueRecovered)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
