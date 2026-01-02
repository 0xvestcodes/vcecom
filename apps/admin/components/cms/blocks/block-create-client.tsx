"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Block Create Client
 * Create a new reusable content block
 */
export function BlockCreateClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState("rich_text");

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error("Please enter a block name");
      return;
    }

    // TODO: Create block via API
    toast.success("Block created");
    router.push("/cms/blocks");
  };

  return (
    <AdminPageLayout
      title="Create Content Block"
      description="Create a new reusable content block"
      breadcrumbs={[
        { label: "CMS", href: "/cms/dashboard" },
        { label: "Content Blocks", href: "/cms/blocks" },
        { label: "Create" },
      ]}
      actions={
        <Button variant="outline" asChild>
          <Link href="/cms/blocks">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      }
    >
      <div className="max-w-2xl space-y-4">
        <div className="space-y-2">
          <Label htmlFor="block-name">Block Name</Label>
          <Input
            id="block-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter block name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="block-type">Block Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="block-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rich_text">Rich Text</SelectItem>
              <SelectItem value="hero">Hero</SelectItem>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="product_reference">
                Product Reference
              </SelectItem>
              <SelectItem value="collection_reference">
                Collection Reference
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" asChild>
            <Link href="/cms/blocks">Cancel</Link>
          </Button>
          <Button onClick={handleCreate}>Create Block</Button>
        </div>
      </div>
    </AdminPageLayout>
  );
}
