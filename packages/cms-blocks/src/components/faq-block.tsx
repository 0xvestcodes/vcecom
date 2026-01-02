"use client";

import { useState } from "react";
import type { BlockComponentProps } from "./types";
import { cn } from "./utils";

interface FaqBlockProps {
  items: Array<{
    question: string;
    answer: string;
  }>;
}

export function FaqBlock({ props }: BlockComponentProps<FaqBlockProps>) {
  const { items, style } = props;
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const variantClasses = {
    default: "",
    inset: "bg-muted/50 p-4 rounded",
    card: "bg-card border rounded-lg p-6",
    section: "bg-accent/10 p-8 rounded-lg",
    ghost: "bg-transparent",
  } as const;

  const blockClasses = cn(
    "space-y-4",
    variantClasses[style?.variant || "default"],
  );

  return (
    <div className={blockClasses}>
      {items.map((item, index) => (
        <div key={index} className="border-b">
          <button
            type="button"
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            className="flex w-full items-center justify-between py-4 text-left"
          >
            <span className="font-semibold">{item.question}</span>
            <span className="text-xl">{openIndex === index ? "−" : "+"}</span>
          </button>
          {openIndex === index && (
            <div className="pb-4 text-muted-foreground">{item.answer}</div>
          )}
        </div>
      ))}
    </div>
  );
}
