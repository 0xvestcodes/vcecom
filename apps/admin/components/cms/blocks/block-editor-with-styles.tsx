"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type BlockType, getBlockDefinition } from "@vcecom/cms-blocks";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BlockDataEditor } from "../pages/block-data-editor";

interface Block {
  id: string;
  type: string;
  order: number;
  props: Record<string, unknown>;
  style?: {
    variant?: "default" | "inset" | "card" | "section" | "ghost";
    padding?: "none" | "sm" | "md" | "lg";
    align?: "left" | "center" | "right";
  };
}

interface BlockEditorWithStylesProps {
  block: Block;
  onSave: (block: Block) => void;
  onCancel?: () => void;
}

const styleSchema = z.object({
  variant: z.enum(["default", "inset", "card", "section", "ghost"]).optional(),
  padding: z.enum(["none", "sm", "md", "lg"]).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
});

export function BlockEditorWithStyles({
  block,
  onSave,
  onCancel,
}: BlockEditorWithStylesProps) {
  const definition = getBlockDefinition(block.type as BlockType);

  // Form for block props (validated against block schema)
  // biome-ignore lint/suspicious/noExplicitAny: zodResolver requires FieldValues type but our schema is generic Record<string, unknown>
  const propsForm = useForm<Record<string, unknown>>({
    resolver: definition?.propsSchema
      ? zodResolver(definition.propsSchema as any)
      : undefined,
    defaultValues: {
      ...definition?.defaultProps,
      ...block.props,
    },
  });

  // Form for style overrides
  const styleForm = useForm<NonNullable<Block["style"]>>({
    resolver: zodResolver(styleSchema),
    defaultValues: block.style || {},
  });

  const handleSave = () => {
    const propsData = propsForm.getValues();
    const styleData = styleForm.getValues();

    // Validate props if definition exists
    if (definition) {
      const validation = definition.propsSchema.safeParse(propsData);
      if (!validation.success) {
        // Show validation errors
        console.error("Validation errors:", validation.error);
        return;
      }
    }

    onSave({
      ...block,
      props: propsData,
      style: Object.keys(styleData).length > 0 ? styleData : undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* Block-specific props */}
      <Card>
        <CardHeader>
          <CardTitle>{definition?.displayName || block.type}</CardTitle>
          <CardDescription>
            {definition?.description || "Configure block properties"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BlockDataEditor
            blockType={block.type}
            blockData={propsForm.watch()}
            onChange={(data) => {
              Object.entries(data).forEach(([key, value]) => {
                propsForm.setValue(key as keyof typeof data, value);
              });
            }}
          />
        </CardContent>
      </Card>

      {/* Style overrides */}
      <Card>
        <CardHeader>
          <CardTitle>Style Overrides</CardTitle>
          <CardDescription>Optional styling for this block</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="style-variant">Variant</Label>
              <Controller
                name="variant"
                control={styleForm.control}
                render={({ field }) => (
                  <Select
                    value={field.value || "default"}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id="style-variant">
                      <SelectValue placeholder="Default" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="inset">Inset</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="section">Section</SelectItem>
                      <SelectItem value="ghost">Ghost</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">
                Visual style variant for the block
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="style-padding">Padding</Label>
              <Controller
                name="padding"
                control={styleForm.control}
                render={({ field }) => (
                  <Select
                    value={field.value || "none"}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id="style-padding">
                      <SelectValue placeholder="Use theme default" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="sm">Small</SelectItem>
                      <SelectItem value="md">Medium</SelectItem>
                      <SelectItem value="lg">Large</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">
                Override block padding
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="style-align">Alignment</Label>
              <Controller
                name="align"
                control={styleForm.control}
                render={({ field }) => (
                  <Select
                    value={field.value || "left"}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id="style-align">
                      <SelectValue placeholder="Left" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">
                Text/content alignment
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="button" onClick={handleSave}>
          Save Block
        </Button>
      </div>
    </div>
  );
}
