/**
 * Maintenance Page Component
 *
 * Displays when maintenance mode is enabled
 */

interface MaintenancePageProps {
  message: string;
}

export function MaintenancePage({ message }: MaintenancePageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold mb-4">Under Maintenance</h1>
        <p className="text-muted-foreground text-lg">{message}</p>
      </div>
    </div>
  );
}
