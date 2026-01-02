"use client";

import { useState } from "react";
import type { BlockComponentProps } from "./types";
import { cn } from "./utils";

interface TestimonialsBlockProps {
  testimonials: Array<{
    name: string;
    text: string;
    role?: string;
    avatar?: string;
  }>;
}

export function TestimonialsBlock({
  props,
}: BlockComponentProps<TestimonialsBlockProps>) {
  const { testimonials, style } = props;
  const [currentIndex, setCurrentIndex] = useState(0);

  const variantClasses = {
    default: "",
    inset: "bg-muted/50 p-4 rounded",
    card: "bg-card border rounded-lg p-6",
    section: "bg-accent/10 p-8 rounded-lg",
    ghost: "bg-transparent",
  } as const;

  const blockClasses = cn(
    "relative",
    variantClasses[style?.variant || "default"],
  );

  const currentTestimonial = testimonials[currentIndex];

  if (!currentTestimonial) {
    return null;
  }

  return (
    <div className={blockClasses}>
      <div className="text-center">
        {currentTestimonial.avatar ? (
          <img
            src={currentTestimonial.avatar}
            alt={currentTestimonial.name}
            className="mx-auto mb-4 h-16 w-16 rounded-full"
          />
        ) : null}
        <p className="mb-4 text-lg italic">"{currentTestimonial.text}"</p>
        <div>
          <p className="font-semibold">{currentTestimonial.name}</p>
          {currentTestimonial.role && (
            <p className="text-sm text-muted-foreground">
              {currentTestimonial.role}
            </p>
          )}
        </div>
      </div>
      {testimonials.length > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {testimonials.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setCurrentIndex(index)}
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                index === currentIndex ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
