"use client";

import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field-error";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAdminCreateContentType } from "@/hooks/cms/use-admin-create-content-type";
import type { CreateContentTypeDto, FieldDefinition } from "@/lib/types/cms";

/**
 * Client component for content type editor
 * Handles content type creation with schema builder
 */
export function ContentTypeEditorClient() {
  const _router = useRouter();
  const createMutation = useAdminCreateContentType();

  const form = useForm<CreateContentTypeDto & { fields: FieldDefinition[] }>({
    defaultValues: {
      name: "",
      displayName: "",
      schema: {
        fields: [],
        displayFields: [],
      },
      isSingleton: false,
      isCollection: true,
      icon: "",
      color: "",
      fields: [],
    },
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "fields",
  });

  const handleSubmit = useCallback(
    async (data: CreateContentTypeDto & { fields: FieldDefinition[] }) => {
      const { fields: formFields, ...rest } = data;
      const schema = {
        fields: formFields,
        displayFields: formFields
          .filter((f) => f.visibleInList)
          .map((f) => f.name),
      };

      await createMutation.mutateAsync({
        ...rest,
        schema: schema as never,
      });
    },
    [createMutation],
  );

  const addField = useCallback(() => {
    append({
      name: "",
      type: "text",
      required: false,
      visibleInList: false,
    });
  }, [append]);

  return (
    <AdminPageLayout
      title="Create Content Type"
      description="Define a new content type with custom fields"
      breadcrumbs={[
        { label: "CMS", href: "/cms/content-types" },
        { label: "Create Content Type" },
      ]}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/cms/content-types">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <Button
            onClick={form.handleSubmit(handleSubmit)}
            disabled={createMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {createMutation.isPending ? "Creating..." : "Create Content Type"}
          </Button>
        </div>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    {...form.register("name", {
                      required: "Name is required",
                      pattern: {
                        value: /^[a-z0-9_]+$/,
                        message: "Name must be lowercase with underscores only",
                      },
                    })}
                    placeholder="blog_post"
                  />
                  <FieldError error={form.formState.errors.name?.message} />
                  <p className="text-xs text-muted-foreground">
                    Unique identifier (lowercase, underscores)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayName">
                    Display Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="displayName"
                    {...form.register("displayName", {
                      required: "Display name is required",
                    })}
                    placeholder="Blog Post"
                  />
                  <FieldError
                    error={form.formState.errors.displayName?.message}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="icon">Icon</Label>
                  <Input
                    id="icon"
                    {...form.register("icon")}
                    placeholder="file-text"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <Input
                    id="color"
                    type="color"
                    {...form.register("color")}
                    className="h-10"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Singleton</Label>
                  <p className="text-xs text-muted-foreground">
                    Only one entry allowed (e.g., homepage)
                  </p>
                </div>
                <Switch
                  checked={form.watch("isSingleton")}
                  onCheckedChange={(checked) => {
                    form.setValue("isSingleton", checked);
                    form.setValue("isCollection", !checked);
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Fields */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Fields</CardTitle>
                <Button type="button" onClick={addField} variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Field
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No fields yet. Click "Add Field" to get started.
                </div>
              ) : (
                fields.map((field, index) => (
                  <FieldEditor
                    key={field.id}
                    index={index}
                    field={field}
                    onRemove={() => remove(index)}
                    form={form}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </form>
      </Form>
    </AdminPageLayout>
  );
}

interface FieldEditorProps {
  index: number;
  field: FieldDefinition & { id?: string };
  onRemove: () => void;
  form: ReturnType<
    typeof useForm<CreateContentTypeDto & { fields: FieldDefinition[] }>
  >;
}

function FieldEditor({
  index,
  field: _field,
  onRemove: _onRemove,
  form,
}: FieldEditorProps) {
  const fieldType = form.watch(`fields.${index}.type`);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="grid grid-cols-2 gap-4 flex-1">
              <div className="space-y-2">
                <Label>
                  Field Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  {...form.register(`fields.${index}.name`, {
                    required: "Field name is required",
                    pattern: {
                      value: /^[a-z0-9_]+$/,
                      message: "Must be lowercase with underscores",
                    },
                  })}
                  placeholder="title"
                />
                <FieldError
                  error={
                    form.formState.errors.fields?.[index]?.name?.message as
                      | string
                      | undefined
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Field Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={fieldType}
                  onValueChange={(value) =>
                    form.setValue(
                      `fields.${index}.type`,
                      value as FieldDefinition["type"],
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="rich_text">Rich Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                    <SelectItem value="select">Select</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="relation">Relation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={_onRemove}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={form.watch(`fields.${index}.required`) || false}
                onCheckedChange={(checked) =>
                  form.setValue(`fields.${index}.required`, checked)
                }
              />
              <Label>Required</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={form.watch(`fields.${index}.visibleInList`) || false}
                onCheckedChange={(checked) =>
                  form.setValue(`fields.${index}.visibleInList`, checked)
                }
              />
              <Label>Visible in List</Label>
            </div>
          </div>

          {fieldType === "select" && (
            <div className="space-y-2">
              <Label>Options (comma-separated)</Label>
              <Input
                placeholder="Option 1, Option 2, Option 3"
                onChange={(e) => {
                  const options = e.target.value
                    .split(",")
                    .map((o) => o.trim())
                    .filter(Boolean);
                  form.setValue(`fields.${index}.options`, options);
                }}
              />
            </div>
          )}

          {fieldType === "relation" && (
            <div className="space-y-2">
              <Label>Related Content Type ID</Label>
              <Input
                placeholder="content-type-id"
                {...form.register(`fields.${index}.relationContentTypeId`)}
              />
            </div>
          )}

          {(fieldType === "text" || fieldType === "rich_text") && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Length</Label>
                <Input
                  type="number"
                  {...form.register(`fields.${index}.minLength`, {
                    valueAsNumber: true,
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Length</Label>
                <Input
                  type="number"
                  {...form.register(`fields.${index}.maxLength`, {
                    valueAsNumber: true,
                  })}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
