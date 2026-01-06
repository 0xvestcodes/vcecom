import { ImportErrors } from "@/components/imports/import-errors";
import { ImportStatus } from "@/components/imports/import-status";

interface ImportJobPageProps {
  params: {
    jobId: string;
  };
}

export default function ImportJobPage({ params }: ImportJobPageProps) {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Import Job Details</h1>
        <p className="text-muted-foreground mt-2">
          View import progress and errors
        </p>
      </div>

      <div className="space-y-6">
        <ImportStatus jobId={params.jobId} />
        <ImportErrors jobId={params.jobId} />
      </div>
    </div>
  );
}
