"use client";

interface MaintenancePageProps {
  title: string;
  message: string;
  expectedEndTime?: string;
}

export function MaintenancePage({
  title,
  message,
  expectedEndTime,
}: MaintenancePageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-2xl w-full text-center space-y-6">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            {title}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground">{message}</p>
        </div>

        {expectedEndTime && (
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Expected completion:{" "}
              <time dateTime={expectedEndTime}>
                {new Date(expectedEndTime).toLocaleString()}
              </time>
            </p>
          </div>
        )}

        <div className="pt-8">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Loading"
              role="img"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Maintenance in progress</span>
          </div>
        </div>
      </div>
    </div>
  );
}
