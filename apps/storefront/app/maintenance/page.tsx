import { MaintenancePage } from "@/components/maintenance/maintenance-page";
import { getContent } from "@/lib/content/content";

export default async function MaintenanceModePage() {
  const maintenance = await getContent("maintenance");

  if (!maintenance || typeof maintenance !== "object") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">
            Maintenance mode not configured
          </h1>
          <p className="text-muted-foreground">
            Please configure maintenance in content registry.
          </p>
        </div>
      </div>
    );
  }

  const maintenanceData = maintenance as {
    enabled?: boolean;
    title?: string;
    message?: string;
    expectedEndTime?: string;
  };

  const title = maintenanceData.title || "Maintenance Mode";
  const message =
    maintenanceData.message ||
    "We're currently performing maintenance. Please check back soon.";

  return (
    <MaintenancePage
      title={title}
      message={message}
      expectedEndTime={maintenanceData.expectedEndTime}
    />
  );
}
