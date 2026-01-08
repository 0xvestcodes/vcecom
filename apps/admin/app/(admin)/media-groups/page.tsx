import { MediaGroupsListClient } from "@/components/media-groups/media-groups-list-client";

/**
 * Media Groups page - Server component
 * Delegates all client-side logic to MediaGroupsListClient component
 */
export default function MediaGroupsPage() {
  return <MediaGroupsListClient />;
}
