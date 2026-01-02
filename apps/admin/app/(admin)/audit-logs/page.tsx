import { AuditLogsListClientRefactored } from "@/components/audit-logs/audit-logs-list-client-refactored";

/**
 * Audit Logs page - Server component
 * Delegates all client-side logic to AuditLogsListClientRefactored component
 */
export default function AuditLogsPage() {
  return <AuditLogsListClientRefactored />;
}
