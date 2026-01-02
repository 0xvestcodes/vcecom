import { ActivityLogsListClientRefactored } from "@/components/activity-logs/activity-logs-list-client-refactored";

/**
 * Activity Logs page - Server component
 * Delegates all client-side logic to ActivityLogsListClientRefactored component
 */
export default function ActivityLogsPage() {
  return <ActivityLogsListClientRefactored />;
}
