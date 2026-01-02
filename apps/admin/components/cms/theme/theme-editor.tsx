"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type UpdateThemeInput,
  useTheme,
  useUpdateTheme,
} from "@/hooks/theme/use-theme";

const oklchColorRegex = /^oklch\([\d.]+ [\d.]+ [\d.]+\)$/;

const themeSchema = z.object({
  colors: z.object({
    primary: z.string().regex(oklchColorRegex, "Must be valid OKLCH format"),
    secondary: z.string().regex(oklchColorRegex, "Must be valid OKLCH format"),
    accent: z.string().regex(oklchColorRegex, "Must be valid OKLCH format"),
    background: z.string().regex(oklchColorRegex, "Must be valid OKLCH format"),
    foreground: z.string().regex(oklchColorRegex, "Must be valid OKLCH format"),
  }),
  sectionPadding: z.enum(["xs", "sm", "md", "lg", "xl"]),
  globalRadius: z.enum(["none", "sm", "md", "lg", "full"]),
  typography: z.object({
    fontSans: z.string().min(1),
    fontSerif: z.string().min(1),
  }),
});

function getColorDescription(color: string): string {
  const descriptions: Record<string, string> = {
    primary: "Main brand color for buttons, links, and highlights",
    secondary: "Secondary actions and subtle backgrounds",
    accent: "Highlights, hover states, and emphasis",
    background: "Main page background color",
    foreground: "Primary text color",
  };
  return descriptions[color] || "";
}

export function ThemeEditor() {
  const { data: theme, isLoading } = useTheme();
  const updateTheme = useUpdateTheme();

  const form = useForm<UpdateThemeInput>({
    resolver: zodResolver(themeSchema),
    defaultValues: {
      colors: {
        primary: "oklch(0.7686 0.1647 70.0804)",
        secondary: "oklch(0.967 0.0029 264.5419)",
        accent: "oklch(0.9869 0.0214 95.2774)",
        background: "oklch(1 0 0)",
        foreground: "oklch(0.2686 0 0)",
      },
      sectionPadding: "md",
      globalRadius: "md",
      typography: {
        fontSans: "Inter, sans-serif",
        fontSerif: "Source Serif 4, serif",
      },
    },
  });

  // Update form when theme loads
  useEffect(() => {
    if (theme) {
      form.reset(theme);
    }
  }, [theme, form]);

  const onSubmit = (data: UpdateThemeInput) => {
    updateTheme.mutate(data);
  };

  if (isLoading) {
    return <div className="p-4">Loading theme...</div>;
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Colors</CardTitle>
          <CardDescription>Configure your brand color palette</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(
            [
              "primary",
              "secondary",
              "accent",
              "background",
              "foreground",
            ] as const
          ).map((color) => (
            <div key={color} className="space-y-2">
              <Label htmlFor={`color-${color}`}>
                {color.charAt(0).toUpperCase() + color.slice(1)}
              </Label>
              <div className="flex gap-2">
                <Input
                  id={`color-${color}`}
                  {...form.register(`colors.${color}`)}
                  placeholder="oklch(0.7686 0.1647 70.0804)"
                  className="flex-1"
                />
                <div
                  className="w-12 h-12 rounded border"
                  style={{
                    backgroundColor:
                      form.watch(`colors.${color}`) || "transparent",
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {getColorDescription(color)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spacing & Layout</CardTitle>
          <CardDescription>Configure spacing and border radius</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="section-padding">Section Padding</Label>
            <Select
              value={form.watch("sectionPadding")}
              onValueChange={(value) =>
                form.setValue(
                  "sectionPadding",
                  value as UpdateThemeInput["sectionPadding"],
                )
              }
            >
              <SelectTrigger id="section-padding">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xs">Extra Small</SelectItem>
                <SelectItem value="sm">Small</SelectItem>
                <SelectItem value="md">Medium</SelectItem>
                <SelectItem value="lg">Large</SelectItem>
                <SelectItem value="xl">Extra Large</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Default vertical padding for page sections
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="global-radius">Border Radius</Label>
            <Select
              value={form.watch("globalRadius")}
              onValueChange={(value) =>
                form.setValue(
                  "globalRadius",
                  value as UpdateThemeInput["globalRadius"],
                )
              }
            >
              <SelectTrigger id="global-radius">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="sm">Small</SelectItem>
                <SelectItem value="md">Medium</SelectItem>
                <SelectItem value="lg">Large</SelectItem>
                <SelectItem value="full">Full (Pill)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Global border radius for buttons, cards, and rounded elements
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Typography</CardTitle>
          <CardDescription>Configure font families</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="font-sans">Sans Serif Font</Label>
            <Input
              id="font-sans"
              {...form.register("typography.fontSans")}
              placeholder="Inter, sans-serif"
            />
            <p className="text-xs text-muted-foreground">
              Used for body text and UI elements
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="font-serif">Serif Font</Label>
            <Input
              id="font-serif"
              {...form.register("typography.fontSerif")}
              placeholder="Source Serif 4, serif"
            />
            <p className="text-xs text-muted-foreground">
              Used for headings and decorative text
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={() => form.reset()}>
          Reset
        </Button>
        <Button type="submit" disabled={updateTheme.isPending}>
          {updateTheme.isPending ? "Saving..." : "Save Theme"}
        </Button>
      </div>
    </form>
  );
}
