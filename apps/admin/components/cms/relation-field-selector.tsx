"use client";

import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAdminEntries } from "@/hooks/cms/use-admin-entries";
import { cn } from "@/lib/utils";

interface RelationFieldSelectorProps {
  contentTypeId: string;
  value?: string;
  onSelect: (entryId: string) => void;
  placeholder?: string;
}

/**
 * Searchable selector for relation fields
 * Allows users to search and select related entries
 */
export function RelationFieldSelector({
  contentTypeId,
  value,
  onSelect,
  placeholder = "Select entry...",
}: RelationFieldSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: entriesData, isLoading } = useAdminEntries(contentTypeId, {
    search: search || undefined,
    limit: 20,
    status: "published",
  });

  const selectedEntry = useMemo(() => {
    if (!value || !entriesData) return null;
    return entriesData.data.find((e) => e.id === value);
  }, [value, entriesData]);

  const handleSelect = (entryId: string) => {
    onSelect(entryId);
    setOpen(false);
  };

  // Get display value for selected entry
  const displayValue = selectedEntry
    ? selectedEntry.slug || selectedEntry.id
    : value || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">{displayValue}</span>
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search entries..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Loading entries..." : "No entries found."}
            </CommandEmpty>
            <CommandGroup>
              {entriesData?.data.map((entry) => {
                const entryTitle =
                  entry.slug ||
                  Object.values(entry.data)[0]?.toString() ||
                  entry.id;
                return (
                  <CommandItem
                    key={entry.id}
                    value={`${entryTitle} ${entry.id}`}
                    onSelect={() => handleSelect(entry.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === entry.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{entryTitle}</span>
                      <span className="text-xs text-muted-foreground">
                        {entry.id}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
