import { Users } from "lucide-react";
import {
  CUSTOMER_EMPTY_STATE_DESCRIPTION_DEFAULT,
  CUSTOMER_EMPTY_STATE_DESCRIPTION_SEARCH,
  CUSTOMER_EMPTY_STATE_TITLE,
} from "@/lib/constants/customers.constants";

interface EmptyCustomersStateProps {
  hasSearchFilter: boolean;
}

/**
 * Empty state component shown when no customers are found
 */
export function EmptyCustomersState({
  hasSearchFilter,
}: EmptyCustomersStateProps) {
  return (
    <div className="text-center py-12 text-muted-foreground rounded-lg border border-border/50 bg-card/30">
      <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
      <p className="text-sm font-medium mb-1">{CUSTOMER_EMPTY_STATE_TITLE}</p>
      <p className="text-xs">
        {hasSearchFilter
          ? CUSTOMER_EMPTY_STATE_DESCRIPTION_SEARCH
          : CUSTOMER_EMPTY_STATE_DESCRIPTION_DEFAULT}
      </p>
    </div>
  );
}
