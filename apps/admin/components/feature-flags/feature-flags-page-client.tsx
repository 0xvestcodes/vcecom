"use client";

import { ChevronDown, ChevronUp, Flag, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminPageLayout } from "@/components/layout/admin-page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFeatureFlags } from "@/hooks/feature-flags/use-feature-flags";
import {
  FEATURE_FLAG_CATEGORIES,
  getCategoryForFlag,
} from "@/lib/constants/feature-flag-categories";
import { CreateFeatureFlagDialog } from "./create-feature-flag-dialog";
import { FeatureFlagRow } from "./feature-flag-row";
import { FeatureFlagScopeDialog } from "./feature-flag-scope-dialog";

export function FeatureFlagsPageClient() {
  const { data, isLoading, error } = useFeatureFlags();
  const [searchQuery, setSearchQuery] = useState("");
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(FEATURE_FLAG_CATEGORIES.map((cat) => cat.id)),
  );

  // Group flags by category
  const flagsByCategory = useMemo(() => {
    if (!data?.flags) return {};

    const grouped: Record<string, typeof data.flags> = {};
    const uncategorized: typeof data.flags = [];

    // Initialize categories
    for (const category of FEATURE_FLAG_CATEGORIES) {
      grouped[category.id] = [];
    }

    // Group flags
    for (const flag of data.flags) {
      const category = getCategoryForFlag(flag.key);
      if (category) {
        grouped[category.id].push(flag);
      } else {
        uncategorized.push(flag);
      }
    }

    // Add uncategorized if any
    if (uncategorized.length > 0) {
      grouped.uncategorized = uncategorized;
    }

    return grouped;
  }, [data?.flags]);

  // Filter flags by search query
  const filteredFlagsByCategory = useMemo(() => {
    if (!searchQuery) return flagsByCategory;
    if (!data) return flagsByCategory;

    const filtered: Record<string, typeof data.flags> = {};
    const searchLower = searchQuery.toLowerCase();

    for (const [categoryId, flags] of Object.entries(flagsByCategory)) {
      const filteredFlags = flags.filter(
        (flag) =>
          flag.key.toLowerCase().includes(searchLower) ||
          flag.description.toLowerCase().includes(searchLower),
      );
      if (filteredFlags.length > 0) {
        filtered[categoryId] = filteredFlags;
      }
    }

    return filtered;
  }, [flagsByCategory, searchQuery, data]);

  // Calculate stats
  const categoryStats = useMemo(() => {
    const stats: Record<
      string,
      { total: number; enabled: number; disabled: number }
    > = {};

    for (const [categoryId, flags] of Object.entries(filteredFlagsByCategory)) {
      stats[categoryId] = {
        total: flags.length,
        enabled: flags.filter((f) => f.defaultState).length,
        disabled: flags.filter((f) => !f.defaultState).length,
      };
    }

    return stats;
  }, [filteredFlagsByCategory]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const getCategoryById = (id: string) => {
    return FEATURE_FLAG_CATEGORIES.find((cat) => cat.id === id);
  };

  return (
    <AdminPageLayout
      title="Feature Flags"
      description="Manage feature flags and their default states. All flags default to OFF and must be explicitly enabled."
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search feature flags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Feature Flag
          </Button>
        </div>

        {isLoading && (
          <div className="text-sm text-muted-foreground">
            Loading feature flags...
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive">
            Error loading feature flags: {error.message}
          </div>
        )}

        {!isLoading && !error && (
          <div className="space-y-4">
            {Object.entries(filteredFlagsByCategory).map(
              ([categoryId, flags]) => {
                const category = getCategoryById(categoryId);
                const stats = categoryStats[categoryId];
                const isExpanded = expandedCategories.has(categoryId);

                if (!category && categoryId !== "uncategorized") return null;

                return (
                  <Collapsible
                    key={categoryId}
                    open={isExpanded}
                    onOpenChange={() => toggleCategory(categoryId)}
                  >
                    <div className="rounded-lg border">
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            {category && (
                              <Flag className="h-5 w-5 text-muted-foreground" />
                            )}
                            <div className="text-left">
                              <div className="font-semibold">
                                {category ? category.name : "Uncategorized"}
                              </div>
                              {category && (
                                <div className="text-sm text-muted-foreground">
                                  {category.description}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {stats && (
                              <div className="flex items-center gap-2 text-sm">
                                <Badge variant="outline" className="text-xs">
                                  {stats.enabled} enabled
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {stats.disabled} disabled
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {stats.total} total
                                </Badge>
                              </div>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Key</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Toggle Default</TableHead>
                                <TableHead>Current State</TableHead>
                                <TableHead>Active Scope</TableHead>
                                <TableHead className="text-right">
                                  Actions
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {flags.length === 0 ? (
                                <TableRow>
                                  <TableCell
                                    colSpan={7}
                                    className="text-center text-muted-foreground"
                                  >
                                    No feature flags in this category
                                  </TableCell>
                                </TableRow>
                              ) : (
                                flags.map((flag) => (
                                  <FeatureFlagRow
                                    key={flag.key}
                                    flag={flag}
                                    onManageScope={() => {
                                      setSelectedFlag(flag.key);
                                      setScopeDialogOpen(true);
                                    }}
                                  />
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              },
            )}

            {Object.keys(filteredFlagsByCategory).length === 0 && (
              <div className="rounded-lg border p-8 text-center text-muted-foreground">
                {searchQuery
                  ? "No feature flags match your search"
                  : "No feature flags found"}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedFlag && (
        <FeatureFlagScopeDialog
          open={scopeDialogOpen}
          onOpenChange={setScopeDialogOpen}
          featureKey={selectedFlag}
        />
      )}

      <CreateFeatureFlagDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </AdminPageLayout>
  );
}
