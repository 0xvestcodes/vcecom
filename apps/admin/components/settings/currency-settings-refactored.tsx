"use client";

import { DollarSign, Edit2, Globe, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SettingsSheet } from "@/components/layout/settings-sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  useCurrencies,
  useDefaultCurrency,
} from "@/hooks/currencies/use-currencies";
import {
  useCreateCurrency,
  useDeleteCurrency,
  useSetDefaultCurrency,
  useUpdateCurrency,
} from "@/hooks/currencies/use-currency-mutations";
import type { CreateCurrencyDto, Currency } from "@/lib/types/currencies";

/**
 * Refactored Currency Settings using SettingsSheet pattern
 */
export function CurrencySettingsRefactored() {
  const { data: currencies = [], isLoading } = useCurrencies();
  const { data: defaultCurrency } = useDefaultCurrency();
  const createCurrency = useCreateCurrency();
  const deleteCurrency = useDeleteCurrency();
  const setDefaultCurrency = useSetDefaultCurrency();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(
    null,
  );

  const handleAdd = () => {
    setSelectedCurrency(null);
    setIsAddDialogOpen(true);
  };

  const handleEdit = (currency: Currency) => {
    setSelectedCurrency(currency);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (currency: Currency) => {
    setSelectedCurrency(currency);
    setIsDeleteDialogOpen(true);
  };

  const handleSetDefault = async (currency: Currency) => {
    if (currency.isDefault) {
      toast.info("This currency is already the default");
      return;
    }
    setDefaultCurrency.mutate(currency.id);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCurrency) return;
    deleteCurrency.mutate(selectedCurrency.id, {
      onSuccess: () => {
        setIsDeleteDialogOpen(false);
        setSelectedCurrency(null);
      },
    });
  };

  return (
    <>
      <SettingsSheet
        title="Currency Settings"
        description="Manage store currencies and exchange rates"
        onSave={() => {}}
        isSaving={false}
      >
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  <CardTitle className="text-sm">Active Currencies</CardTitle>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAdd}
                  className="h-8"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Currency
                </Button>
              </div>
              <CardDescription className="text-xs">
                Currencies available for your store. Exchange rates are
                automatically fetched from the configured FX provider.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-sm text-muted-foreground">
                  Loading currencies...
                </div>
              ) : currencies.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No currencies configured. Add your first currency to get
                  started.
                </div>
              ) : (
                <div className="space-y-3">
                  {currencies.map((currency) => (
                    <div
                      key={currency.id}
                      className="flex items-center justify-between rounded-lg border border-border/50 bg-card/30 p-3 transition-all duration-200 hover:bg-card/50"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">
                              {currency.code}
                            </span>
                            {currency.isDefault && (
                              <Badge variant="default" className="text-xs">
                                Default
                              </Badge>
                            )}
                            {!currency.isActive && (
                              <Badge variant="secondary" className="text-xs">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {currency.name} ({currency.symbol})
                          </p>
                          {currency.exchangeRate && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Rate: 1 {defaultCurrency?.code || "INR"} ={" "}
                              {currency.exchangeRate.toFixed(4)} {currency.code}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!currency.isDefault && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSetDefault(currency)}
                            disabled={setDefaultCurrency.isPending}
                            className="h-8 w-8 p-0"
                            title="Set as default"
                          >
                            <Star className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(currency)}
                          className="h-8 w-8 p-0"
                          title="Edit currency"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        {!currency.isDefault && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(currency)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            title="Delete currency"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="rounded-lg border border-border/50 bg-card/30 p-3">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> Exchange rates are cached for 1 hour and
              automatically refreshed. Configure your FX provider API key in
              environment variables (FX_PROVIDER_API_KEY).
            </p>
          </div>
        </div>
      </SettingsSheet>

      {/* Add Currency Dialog */}
      <AddCurrencyDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onCreate={(data) => {
          createCurrency.mutate(data, {
            onSuccess: () => {
              setIsAddDialogOpen(false);
            },
          });
        }}
        isCreating={createCurrency.isPending}
      />

      {/* Edit Currency Dialog */}
      {selectedCurrency && (
        <EditCurrencyDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          currency={selectedCurrency}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Currency</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCurrency?.code}? This
              action cannot be undone. You cannot delete the default currency.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface AddCurrencyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: CreateCurrencyDto) => void;
  isCreating: boolean;
}

function AddCurrencyDialog({
  open,
  onOpenChange,
  onCreate,
  isCreating,
}: AddCurrencyDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [decimalPlaces, setDecimalPlaces] = useState(2);
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);

  const handleSubmit = () => {
    if (!code || !name || !symbol) {
      toast.error("Please fill in all required fields");
      return;
    }

    onCreate({
      code: code.toUpperCase(),
      name,
      symbol,
      decimalPlaces,
      isActive,
      isDefault,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Currency</DialogTitle>
          <DialogDescription>
            Add a new currency to your store. Use ISO 4217 currency codes (e.g.,
            USD, EUR, GBP).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="code">Currency Code (ISO 4217) *</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="USD"
              maxLength={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Currency Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="US Dollar"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="symbol">Currency Symbol *</Label>
            <Input
              id="symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="$"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="decimalPlaces">Decimal Places</Label>
            <Input
              id="decimalPlaces"
              type="number"
              value={decimalPlaces}
              onChange={(e) =>
                setDecimalPlaces(parseInt(e.target.value, 10) || 2)
              }
              min={0}
              max={4}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="isActive">Active</Label>
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="isDefault">Set as Default</Label>
            <Switch
              id="isDefault"
              checked={isDefault}
              onCheckedChange={setIsDefault}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Currency"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EditCurrencyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: Currency;
}

function EditCurrencyDialog({
  open,
  onOpenChange,
  currency,
}: EditCurrencyDialogProps) {
  const updateCurrency = useUpdateCurrency(currency.id);
  const [name, setName] = useState(currency.name);
  const [symbol, setSymbol] = useState(currency.symbol);
  const [decimalPlaces, setDecimalPlaces] = useState(currency.decimalPlaces);
  const [isActive, setIsActive] = useState(currency.isActive);
  const [isDefault, setIsDefault] = useState(currency.isDefault);

  const handleSubmit = () => {
    updateCurrency.mutate(
      {
        name,
        symbol,
        decimalPlaces,
        isActive,
        isDefault,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Currency ({currency.code})</DialogTitle>
          <DialogDescription>
            Update currency settings. Currency code cannot be changed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Currency Code</Label>
            <Input value={currency.code} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-name">Currency Name *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-symbol">Currency Symbol *</Label>
            <Input
              id="edit-symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-decimalPlaces">Decimal Places</Label>
            <Input
              id="edit-decimalPlaces"
              type="number"
              value={decimalPlaces}
              onChange={(e) =>
                setDecimalPlaces(parseInt(e.target.value, 10) || 2)
              }
              min={0}
              max={4}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="edit-isActive">Active</Label>
            <Switch
              id="edit-isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="edit-isDefault">Set as Default</Label>
            <Switch
              id="edit-isDefault"
              checked={isDefault}
              onCheckedChange={setIsDefault}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={updateCurrency.isPending}>
            {updateCurrency.isPending ? "Updating..." : "Update Currency"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
