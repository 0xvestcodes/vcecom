"use client";

import { Check, X } from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface InlineEditableProps {
  value: string;
  onChange: (value: string) => void | Promise<void>;
  renderDisplay?: (value: string) => ReactNode;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  validate?: (value: string) => string | null;
  onCancel?: () => void;
}

/**
 * Inline Editable Component
 *
 * Click to edit inline:
 * - Works for titles, prices, status, etc.
 * - Auto-save on blur or explicit save
 * - Validation feedback
 *
 * @example
 * ```tsx
 * <InlineEditable
 *   value={product.title}
 *   onChange={handleTitleChange}
 *   placeholder="Enter product title"
 * />
 * ```
 */
export function InlineEditable({
  value,
  onChange,
  renderDisplay,
  placeholder,
  className,
  inputClassName,
  validate,
  onCancel,
}: InlineEditableProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditValue(value);
    setError(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(value);
    setError(null);
    onCancel?.();
  };

  const handleSave = async () => {
    if (validate) {
      const validationError = validate(editValue);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setIsSaving(true);
    try {
      await onChange(editValue);
      setIsEditing(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex-1">
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            placeholder={placeholder}
            className={cn(inputClassName, error && "border-destructive")}
            disabled={isSaving}
          />
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleSave}
          disabled={isSaving}
          className="h-8 w-8"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleCancel}
          disabled={isSaving}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleStartEdit}
      className={cn(
        "text-left hover:bg-muted/50 rounded px-2 py-1 transition-colors",
        className,
      )}
    >
      {renderDisplay ? renderDisplay(value) : value || placeholder}
    </button>
  );
}
