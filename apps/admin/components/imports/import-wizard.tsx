"use client";

import { Download, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateImportJob } from "@/hooks/imports/use-import-job";
import { endpoints } from "@/lib/endpoints";

type ImportType = "products" | "categories" | "inventory" | "customers";
type ImportSource = "csv" | "excel" | "json";

export function ImportWizard() {
  const [type, setType] = useState<ImportType>("products");
  const [source, setSource] = useState<ImportSource>("csv");
  const [file, setFile] = useState<File | null>(null);
  const [skipErrors, setSkipErrors] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [dryRun, setDryRun] = useState(false);

  const createMutation = useCreateImportJob();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const url = `${baseUrl}${endpoints.imports.template(type, source === "excel" ? "excel" : "csv")}`;

      const response = await fetch(url, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to download template");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${type}-template.${source === "excel" ? "xlsx" : "csv"}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      toast.success("Template downloaded");
    } catch (_error) {
      toast.error("Failed to download template");
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        type,
        source,
        file,
        options: {
          skipErrors,
          updateExisting,
          dryRun,
        },
      });

      toast.success(`Import job created: ${result.id}`);
      // Reset form
      setFile(null);
      setSkipErrors(false);
      setUpdateExisting(false);
      setDryRun(false);
    } catch (_error) {
      toast.error("Failed to create import job");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Data</CardTitle>
        <CardDescription>
          Upload a file to import products, categories, inventory, or customers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Import Type</Label>
          <Select
            value={type}
            onValueChange={(value) => setType(value as ImportType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="products">Products</SelectItem>
              <SelectItem value="categories">Categories</SelectItem>
              <SelectItem value="inventory">Inventory</SelectItem>
              <SelectItem value="customers">Customers</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>File Format</Label>
          <Select
            value={source}
            onValueChange={(value) => setSource(value as ImportSource)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="excel">Excel (.xlsx)</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>File</Label>
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept={
                source === "csv"
                  ? ".csv"
                  : source === "excel"
                    ? ".xlsx,.xls"
                    : ".json"
              }
              onChange={handleFileSelect}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadTemplate}
            >
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
          </div>
          {file && (
            <p className="text-sm text-muted-foreground">
              Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </p>
          )}
        </div>

        <div className="space-y-4">
          <Label>Options</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="skipErrors"
                checked={skipErrors}
                onCheckedChange={(checked) => setSkipErrors(checked === true)}
              />
              <Label htmlFor="skipErrors" className="cursor-pointer">
                Skip errors and continue processing
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="updateExisting"
                checked={updateExisting}
                onCheckedChange={(checked) =>
                  setUpdateExisting(checked === true)
                }
              />
              <Label htmlFor="updateExisting" className="cursor-pointer">
                Update existing records
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="dryRun"
                checked={dryRun}
                onCheckedChange={(checked) => setDryRun(checked === true)}
              />
              <Label htmlFor="dryRun" className="cursor-pointer">
                Dry run (validate only)
              </Label>
            </div>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!file || createMutation.isPending}
          className="w-full"
        >
          <Upload className="mr-2 h-4 w-4" />
          {createMutation.isPending ? "Creating..." : "Start Import"}
        </Button>
      </CardContent>
    </Card>
  );
}
