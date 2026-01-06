"use client";

import { AlertCircle, RotateCcw, Save, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  useRelevanceConfig,
  useResetRelevanceConfig,
  useUpdateRelevanceConfig,
} from "@/hooks/search/use-relevance-config";

/**
 * Relevance Config Card Component
 * Allows configuring search relevance settings
 */
export function RelevanceConfigCard() {
  const { data: config, isLoading } = useRelevanceConfig();
  const { mutate: updateConfig, isPending: isUpdating } =
    useUpdateRelevanceConfig();
  const { mutate: resetConfig, isPending: isResetting } =
    useResetRelevanceConfig();

  const [fieldWeights, setFieldWeights] = useState({
    title: 2.0,
    description: 1.0,
    sku: 1.5,
    tags: 1.2,
    collectionNames: 1.0,
  });

  const [boostFactors, setBoostFactors] = useState({
    popularity: 1.0,
    recency: 1.0,
    inventoryStatus: 1.1,
  });

  const [stopWords, setStopWords] = useState<string>("");
  const [synonyms, setSynonyms] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (config) {
      if (config.fieldWeights) {
        setFieldWeights({
          title: config.fieldWeights.title ?? 2.0,
          description: config.fieldWeights.description ?? 1.0,
          sku: config.fieldWeights.sku ?? 1.5,
          tags: config.fieldWeights.tags ?? 1.2,
          collectionNames: config.fieldWeights.collectionNames ?? 1.0,
        });
      }
      if (config.boostFactors) {
        setBoostFactors({
          popularity: config.boostFactors.popularity ?? 1.0,
          recency: config.boostFactors.recency ?? 1.0,
          inventoryStatus: config.boostFactors.inventoryStatus ?? 1.1,
        });
      }
      if (config.stopWords) {
        setStopWords(config.stopWords.join("\n"));
      }
      if (config.synonyms) {
        setSynonyms(config.synonyms);
      }
    }
  }, [config]);

  const handleSave = () => {
    const stopWordsArray = stopWords
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    updateConfig(
      {
        fieldWeights,
        boostFactors,
        stopWords: stopWordsArray,
        synonyms: Object.keys(synonyms).length > 0 ? synonyms : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Configuration Updated", {
            description: "Search relevance configuration has been updated.",
          });
        },
        onError: (error) => {
          toast.error("Error", {
            description: error.message || "Failed to update configuration",
          });
        },
      },
    );
  };

  const handleReset = () => {
    resetConfig(undefined, {
      onSuccess: () => {
        toast.success("Configuration Reset", {
          description:
            "Search relevance configuration has been reset to defaults.",
        });
      },
      onError: (error) => {
        toast.error("Error", {
          description: error.message || "Failed to reset configuration",
        });
      },
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Relevance Configuration</CardTitle>
          <CardDescription>Loading configuration...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>Relevance Configuration</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isResetting}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isUpdating}>
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
          </div>
        </div>
        <CardDescription>
          Configure search relevance tuning (field weights, boost factors,
          synonyms, stop words)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="weights" className="space-y-4">
          <TabsList>
            <TabsTrigger value="weights">Field Weights</TabsTrigger>
            <TabsTrigger value="boosts">Boost Factors</TabsTrigger>
            <TabsTrigger value="synonyms">Synonyms</TabsTrigger>
            <TabsTrigger value="stopwords">Stop Words</TabsTrigger>
          </TabsList>

          <TabsContent value="weights" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title-weight">Title Weight</Label>
                <Input
                  id="title-weight"
                  type="number"
                  step="0.1"
                  min="0"
                  value={fieldWeights.title}
                  onChange={(e) =>
                    setFieldWeights({
                      ...fieldWeights,
                      title: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description-weight">Description Weight</Label>
                <Input
                  id="description-weight"
                  type="number"
                  step="0.1"
                  min="0"
                  value={fieldWeights.description}
                  onChange={(e) =>
                    setFieldWeights({
                      ...fieldWeights,
                      description: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku-weight">SKU Weight</Label>
                <Input
                  id="sku-weight"
                  type="number"
                  step="0.1"
                  min="0"
                  value={fieldWeights.sku}
                  onChange={(e) =>
                    setFieldWeights({
                      ...fieldWeights,
                      sku: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags-weight">Tags Weight</Label>
                <Input
                  id="tags-weight"
                  type="number"
                  step="0.1"
                  min="0"
                  value={fieldWeights.tags}
                  onChange={(e) =>
                    setFieldWeights({
                      ...fieldWeights,
                      tags: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="collection-weight">
                  Collection Names Weight
                </Label>
                <Input
                  id="collection-weight"
                  type="number"
                  step="0.1"
                  min="0"
                  value={fieldWeights.collectionNames}
                  onChange={(e) =>
                    setFieldWeights({
                      ...fieldWeights,
                      collectionNames: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="boosts" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="popularity-boost">Popularity Boost</Label>
                <Input
                  id="popularity-boost"
                  type="number"
                  step="0.1"
                  min="0"
                  value={boostFactors.popularity}
                  onChange={(e) =>
                    setBoostFactors({
                      ...boostFactors,
                      popularity: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recency-boost">Recency Boost</Label>
                <Input
                  id="recency-boost"
                  type="number"
                  step="0.1"
                  min="0"
                  value={boostFactors.recency}
                  onChange={(e) =>
                    setBoostFactors({
                      ...boostFactors,
                      recency: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inventory-boost">Inventory Status Boost</Label>
                <Input
                  id="inventory-boost"
                  type="number"
                  step="0.1"
                  min="0"
                  value={boostFactors.inventoryStatus}
                  onChange={(e) =>
                    setBoostFactors({
                      ...boostFactors,
                      inventoryStatus: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="synonyms" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Synonyms Configuration</AlertTitle>
              <AlertDescription>
                Synonyms configuration is not yet available in the UI. Please
                use the API directly or wait for a future update.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="stopwords" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stopwords">Stop Words (one per line)</Label>
              <Textarea
                id="stopwords"
                rows={10}
                value={stopWords}
                onChange={(e) => setStopWords(e.target.value)}
                placeholder="a&#10;an&#10;the&#10;and&#10;or"
              />
              <p className="text-xs text-muted-foreground">
                Enter stop words, one per line. These words will be ignored
                during search.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
