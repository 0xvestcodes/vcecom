"use client";

import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useImportJobErrors } from "@/hooks/imports/use-import-job";

interface ImportErrorsProps {
  jobId: string;
}

export function ImportErrors({ jobId }: ImportErrorsProps) {
  const { data: errors, isLoading } = useImportJobErrors(jobId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Loading errors...</p>
        </CardContent>
      </Card>
    );
  }

  if (!errors || errors.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">No errors found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          Import Errors ({errors.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Row</TableHead>
              <TableHead>Field</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Error Code</TableHead>
              <TableHead>Error Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {errors.map((error) => (
              <TableRow key={error.id}>
                <TableCell>{error.rowNumber}</TableCell>
                <TableCell>{error.field || "-"}</TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {error.value || "-"}
                </TableCell>
                <TableCell>
                  <code className="text-xs">{error.errorCode}</code>
                </TableCell>
                <TableCell>{error.errorMessage}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
