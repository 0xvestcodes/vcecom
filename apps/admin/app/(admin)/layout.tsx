import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CommandPalette } from "@/components/command-palette";
import { ErrorBoundaryWrapper } from "@/components/common/error-boundary-wrapper";
import { AdminShell } from "@/components/layout/admin-shell";
import { SidebarSkeleton } from "@/components/skeletons/sidebar-skeleton";
import { CommandKProvider } from "@/hooks/use-command-k";
import { serverApiFetch } from "@/lib/api";
import type { AdminSession } from "@/lib/auth";
import { endpoints } from "@/lib/endpoints";
import { SessionProvider } from "@/providers/session-provider";

async function getSession(): Promise<AdminSession | null> {
  try {
    // Get cookies from Next.js
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // Direct backend call from server component (cookies forwarded)
    const session = await serverApiFetch<AdminSession>(endpoints.auth.me, {
      cookies: cookieHeader,
    });

    return session;
  } catch (_error) {
    return null;
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Route protection is handled by middleware
  // This layout just ensures user is authenticated

  return (
    <ErrorBoundaryWrapper>
      <SessionProvider initialSession={session}>
        <CommandKProvider>
          <AdminShell>
            <Suspense fallback={<SidebarSkeleton />}>
              <ErrorBoundaryWrapper>{children}</ErrorBoundaryWrapper>
            </Suspense>
          </AdminShell>
          <CommandPalette />
        </CommandKProvider>
      </SessionProvider>
    </ErrorBoundaryWrapper>
  );
}
