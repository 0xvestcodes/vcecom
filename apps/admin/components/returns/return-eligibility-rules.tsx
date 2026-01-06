"use client";

import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api";

interface EligibilityRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  conditions: Record<string, unknown>;
  maxDaysAfterDelivery?: number;
  allowedReasons?: string[];
  excludedCategories?: string[];
  excludedProducts?: string[];
  minOrderValue?: number;
  maxReturnsPerCustomer?: number;
}

export function ReturnEligibilityRules() {
  const { data: rules, isLoading } = useApiQuery<EligibilityRule[]>(
    "/api/admin/returns/eligibility-rules",
  );

  const _createRule = useApiMutation<EligibilityRule, Partial<EligibilityRule>>(
    {
      mutationFn: async (data) => {
        return api.post<EligibilityRule>(
          "/api/admin/returns/eligibility-rules",
          data,
        );
      },
      onSuccess: () => {
        toast.success("Eligibility rule created");
      },
    },
  );

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Return Eligibility Rules</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {rules && rules.length > 0 ? (
            rules.map((rule) => (
              <div key={rule.id} className="border-b pb-4">
                <div className="flex justify-between">
                  <div>
                    <h3 className="font-medium">{rule.name}</h3>
                    {rule.description && (
                      <p className="text-sm text-muted-foreground">
                        {rule.description}
                      </p>
                    )}
                  </div>
                  <Badge variant={rule.enabled ? "default" : "secondary"}>
                    {rule.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Priority: {rule.priority}
                  {rule.maxDaysAfterDelivery && (
                    <> · Max Days: {rule.maxDaysAfterDelivery}</>
                  )}
                  {rule.minOrderValue && (
                    <> · Min Order Value: ₹{rule.minOrderValue}</>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No eligibility rules configured
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
