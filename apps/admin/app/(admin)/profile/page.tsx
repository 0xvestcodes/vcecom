import { ProfilePageClient } from "@/components/profile/profile-page-client";

/**
 * Profile page - Server component
 * Delegates all client-side logic to ProfilePageClient component
 */
export default function ProfilePage() {
  return <ProfilePageClient />;
}
