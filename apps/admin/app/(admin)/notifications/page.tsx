import { NotificationsListClientRefactored } from "@/components/notifications/notifications-list-client-refactored";

/**
 * Notifications page - Server component
 * Delegates all client-side logic to NotificationsListClientRefactored component
 */
export default function NotificationsPage() {
  return <NotificationsListClientRefactored />;
}
