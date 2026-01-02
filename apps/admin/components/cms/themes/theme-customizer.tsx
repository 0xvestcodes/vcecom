"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useThemeSettings,
  useUpdateThemeSettings,
} from "@/hooks/cms/use-theme-settings";
import { useDebounce } from "@/hooks/use-debounce";
import type { ThemeSettingsDto } from "@/lib/types/themes";

interface ThemeCustomizerProps {
  themeId: string;
  onSettingsChange?: (settings: ThemeSettingsDto) => void;
}

/**
 * Theme customizer component
 * Allows editing theme colors, typography, buttons, and layout
 */
export function ThemeCustomizer({
  themeId,
  onSettingsChange,
}: ThemeCustomizerProps) {
  const { data: themeSettingsResponse, isLoading } = useThemeSettings(themeId);
  const updateSettings = useUpdateThemeSettings(themeId);
  const themeSettings = themeSettingsResponse as
    | { settingsOverrides?: ThemeSettingsDto }
    | undefined;

  const [localSettings, setLocalSettings] = useState<ThemeSettingsDto>({});

  // Initialize local settings from fetched data
  useEffect(() => {
    if (themeSettings) {
      setLocalSettings(themeSettings.settingsOverrides || {});
    }
  }, [themeSettings]);

  // Debounce settings updates
  const debouncedSettings = useDebounce(localSettings, 500);

  // Notify parent of changes
  useEffect(() => {
    if (Object.keys(debouncedSettings).length > 0) {
      onSettingsChange?.(debouncedSettings);
    }
  }, [debouncedSettings, onSettingsChange]);

  const handleColorChange = (key: string, value: string) => {
    setLocalSettings((prev) => ({
      ...prev,
      colors: {
        ...prev.colors,
        [key]: value,
      },
    }));
  };

  const handleTypographyChange = (key: string, value: string | number) => {
    setLocalSettings((prev) => ({
      ...prev,
      typography: {
        ...prev.typography,
        [key]: value,
      },
    }));
  };

  const handleButtonChange = (key: string, value: string) => {
    setLocalSettings((prev) => ({
      ...prev,
      buttons: {
        ...prev.buttons,
        [key]: value,
      },
    }));
  };

  const handleLayoutChange = (key: string, value: string) => {
    setLocalSettings((prev) => ({
      ...prev,
      layout: {
        ...prev.layout,
        [key]: value,
      },
    }));
  };

  const handleSave = () => {
    updateSettings.mutate(localSettings);
  };

  if (isLoading) {
    return <div className="p-4">Loading theme settings...</div>;
  }

  const baseTheme: ThemeSettingsDto = themeSettings?.settingsOverrides || {};
  const colors = { ...baseTheme.colors, ...localSettings.colors };
  const typography = { ...baseTheme.typography, ...localSettings.typography };
  const buttons = { ...baseTheme.buttons, ...localSettings.buttons };
  const layout = { ...baseTheme.layout, ...localSettings.layout };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm mb-2">Theme Settings</h3>
        <button
          type="button"
          onClick={handleSave}
          disabled={updateSettings.isPending}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
        >
          {updateSettings.isPending ? "Saving..." : "Save Changes"}
        </button>
      </div>
      <ScrollArea className="flex-1">
        <Tabs defaultValue="colors" className="p-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="colors">Colors</TabsTrigger>
            <TabsTrigger value="typography">Typography</TabsTrigger>
            <TabsTrigger value="buttons">Buttons</TabsTrigger>
            <TabsTrigger value="layout">Layout</TabsTrigger>
          </TabsList>

          <TabsContent value="colors" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={colors?.primary || "#000000"}
                  onChange={(e) => handleColorChange("primary", e.target.value)}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={colors?.primary || "#000000"}
                  onChange={(e) => handleColorChange("primary", e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Secondary Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={colors?.secondary || "#666666"}
                  onChange={(e) =>
                    handleColorChange("secondary", e.target.value)
                  }
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={colors?.secondary || "#666666"}
                  onChange={(e) =>
                    handleColorChange("secondary", e.target.value)
                  }
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Accent Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={colors?.accent || "#0066FF"}
                  onChange={(e) => handleColorChange("accent", e.target.value)}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={colors?.accent || "#0066FF"}
                  onChange={(e) => handleColorChange("accent", e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Background Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={colors?.background || "#FFFFFF"}
                  onChange={(e) =>
                    handleColorChange("background", e.target.value)
                  }
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={colors?.background || "#FFFFFF"}
                  onChange={(e) =>
                    handleColorChange("background", e.target.value)
                  }
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Foreground Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={colors?.foreground || "#000000"}
                  onChange={(e) =>
                    handleColorChange("foreground", e.target.value)
                  }
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={colors?.foreground || "#000000"}
                  onChange={(e) =>
                    handleColorChange("foreground", e.target.value)
                  }
                  className="flex-1"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="typography" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Font Family</Label>
              <Input
                value={typography?.fontFamily || ""}
                onChange={(e) =>
                  handleTypographyChange("fontFamily", e.target.value)
                }
                placeholder="Inter, sans-serif"
              />
            </div>
            <div className="space-y-2">
              <Label>Heading Font Family</Label>
              <Input
                value={typography?.fontFamilyHeading || ""}
                onChange={(e) =>
                  handleTypographyChange("fontFamilyHeading", e.target.value)
                }
                placeholder="Inter, sans-serif"
              />
            </div>
          </TabsContent>

          <TabsContent value="buttons" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Border Radius</Label>
              <select
                value={buttons?.borderRadius || "md"}
                onChange={(e) =>
                  handleButtonChange("borderRadius", e.target.value)
                }
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="none">None</option>
                <option value="sm">Small</option>
                <option value="md">Medium</option>
                <option value="lg">Large</option>
                <option value="full">Full</option>
              </select>
            </div>
          </TabsContent>

          <TabsContent value="layout" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Container Max Width</Label>
              <Input
                value={layout?.containerMaxWidth || "1280px"}
                onChange={(e) =>
                  handleLayoutChange("containerMaxWidth", e.target.value)
                }
                placeholder="1280px"
              />
            </div>
            <div className="space-y-2">
              <Label>Header Height</Label>
              <Input
                value={layout?.headerHeight || "4rem"}
                onChange={(e) =>
                  handleLayoutChange("headerHeight", e.target.value)
                }
                placeholder="4rem"
              />
            </div>
            <div className="space-y-2">
              <Label>Cart Drawer Width</Label>
              <Input
                value={layout?.cartDrawerWidth || "400px"}
                onChange={(e) =>
                  handleLayoutChange("cartDrawerWidth", e.target.value)
                }
                placeholder="400px"
              />
            </div>
          </TabsContent>
        </Tabs>
      </ScrollArea>
    </div>
  );
}
