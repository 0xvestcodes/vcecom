"use client";

import {
  Copy,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  Trash2,
} from "lucide-react";
import NextImage from "next/image";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCopyToClipboard } from "@/hooks/common/use-copy-to-clipboard";
import type { FileMetadata } from "@/lib/types/storage";
import {
  formatFileSize,
  isImageFile,
  truncateUrl,
} from "@/lib/utils/file-utils";

interface StorageFilesTableProps {
  files: FileMetadata[];
  onPreview: (file: FileMetadata) => void;
  onDelete: (key: string) => void;
  isLoading?: boolean;
}

export function StorageFilesTable({
  files,
  onPreview,
  onDelete,
  isLoading = false,
}: StorageFilesTableProps) {
  const { copyToClipboard } = useCopyToClipboard();

  if (isLoading) {
    return (
      <div className="rounded-xl border-border/50 overflow-hidden transition-all duration-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Size</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }, (_, i) => (
              <TableRow key={`skeleton-row-${String(i)}`}>
                <TableCell className="h-10 animate-pulse bg-muted/30" />
                <TableCell className="h-10 animate-pulse bg-muted/30" />
                <TableCell className="h-10 animate-pulse bg-muted/30" />
                <TableCell className="h-10 animate-pulse bg-muted/30" />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border-border/50 overflow-hidden transition-all duration-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Preview</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>URL</TableHead>
            <TableHead className="w-[120px]">Size</TableHead>
            <TableHead className="w-[180px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <TableRow
              key={file.key}
              className="group hover:bg-muted/30 transition-colors"
            >
              <TableCell className="text-xs">
                {isImageFile(file.key) ? (
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-border/50 bg-muted/30">
                    <NextImage
                      src={file.url}
                      alt={file.key}
                      fill
                      className="object-cover"
                      unoptimized
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-lg border border-border/50 bg-muted/30 flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </TableCell>
              <TableCell className="text-xs">
                <div
                  className="font-mono max-w-[300px] truncate"
                  title={file.key}
                >
                  {file.key}
                </div>
              </TableCell>
              <TableCell className="text-xs">
                <div className="flex items-center gap-2 max-w-[400px]">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline truncate flex-1"
                    title={file.url}
                  >
                    {truncateUrl(file.url)}
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    onClick={() => copyToClipboard(file.url, "URL")}
                    title="Copy URL"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    onClick={() => window.open(file.url, "_blank")}
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
              <TableCell className="text-xs">
                {file.size ? (
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {formatFileSize(file.size)}
                    </span>
                    {file.contentType && (
                      <span className="text-xs text-muted-foreground mt-0.5">
                        {file.contentType.split("/")[1]?.toUpperCase() ||
                          file.contentType}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-xs">
                <div className="flex items-center gap-1">
                  {isImageFile(file.key) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      onClick={() => onPreview(file)}
                      title="Preview file"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    onClick={() => copyToClipboard(file.key, "Key")}
                    title="Copy key"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    onClick={() => onDelete(file.key)}
                    title="Delete file"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
