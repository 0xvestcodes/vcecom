"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { richTextBlock } from "@vcecom/cms-blocks";
import { useForm } from "react-hook-form";
import type { BlockFormProps } from "../types";

type RichTextFormData = {
  content?: unknown;
};

export function RichTextForm({
  form,
  onSubmit,
  onCancel,
}: BlockFormProps<RichTextFormData>) {
  const handleSubmit = form.handleSubmit((data) => {
    onSubmit?.(data);
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="rich-text-content"
          className="block text-sm font-medium mb-1"
        >
          Content
        </label>
        <textarea
          id="rich-text-content"
          {...form.register("content")}
          className="w-full px-3 py-2 border rounded-md"
          placeholder="Enter rich text content"
          rows={10}
        />
        {form.formState.errors.content && (
          <p className="text-sm text-red-500 mt-1">
            {form.formState.errors.content.message}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Save
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * Create rich text form with react-hook-form
 */
export function createRichTextForm(defaultValues?: RichTextFormData) {
  return useForm<RichTextFormData>({
    resolver: zodResolver(richTextBlock.propsSchema as any) as any,
    defaultValues: defaultValues || richTextBlock.defaultProps,
  });
}
