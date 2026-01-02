"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { heroBlock } from "@vcecom/cms-blocks";
import { useForm } from "react-hook-form";
import { ImageUploadField } from "../components/image-upload-field";
import type { BlockFormProps } from "../types";

type HeroFormData = {
  title?: string;
  subtitle?: string;
  backgroundImage?: string;
  ctaText?: string;
  ctaLink?: string;
};

export function HeroForm({
  form,
  onSubmit,
  onCancel,
}: BlockFormProps<HeroFormData>) {
  const handleSubmit = form.handleSubmit((data) => {
    onSubmit?.(data);
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          {...form.register("title")}
          type="text"
          className="w-full px-3 py-2 border rounded-md"
          placeholder="Enter hero title"
        />
        {form.formState.errors.title && (
          <p className="text-sm text-red-500 mt-1">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Subtitle</label>
        <textarea
          {...form.register("subtitle")}
          className="w-full px-3 py-2 border rounded-md"
          placeholder="Enter hero subtitle"
          rows={3}
        />
        {form.formState.errors.subtitle && (
          <p className="text-sm text-red-500 mt-1">
            {form.formState.errors.subtitle.message}
          </p>
        )}
      </div>

      <div>
        <ImageUploadField
          label="Background Image"
          value={form.watch("backgroundImage") || null}
          onChange={(url) => form.setValue("backgroundImage", url || "")}
          prefix="cms/blocks/hero"
        />
        {form.formState.errors.backgroundImage && (
          <p className="text-sm text-red-500 mt-1">
            {form.formState.errors.backgroundImage.message}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">CTA Text</label>
        <input
          {...form.register("ctaText")}
          type="text"
          className="w-full px-3 py-2 border rounded-md"
          placeholder="Shop Now"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">CTA Link</label>
        <input
          {...form.register("ctaLink")}
          type="url"
          className="w-full px-3 py-2 border rounded-md"
          placeholder="/products"
        />
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
 * Create hero form with react-hook-form
 */
export function createHeroForm(defaultValues?: HeroFormData) {
  return useForm<HeroFormData>({
    resolver: zodResolver(heroBlock.propsSchema),
    defaultValues: defaultValues || heroBlock.defaultProps,
  });
}
