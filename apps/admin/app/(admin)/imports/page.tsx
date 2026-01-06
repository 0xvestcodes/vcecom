import { ImportWizard } from "@/components/imports/import-wizard";

export default function ImportsPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Import Data</h1>
        <p className="text-muted-foreground mt-2">
          Import products, categories, inventory, or customers from CSV, Excel,
          or JSON files
        </p>
      </div>

      <div className="max-w-2xl">
        <ImportWizard />
      </div>
    </div>
  );
}
