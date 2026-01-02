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
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

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
      {items.map((item) => (
        <div
          key={item.question || `faq-${item.answer?.substring(0, 20)}`}
          className="border-b"
        >
          <button
            type="button"
            onClick={() =>
              setOpenQuestion(
                openQuestion === item.question ? null : item.question,
              )
            }
            className="flex w-full items-center justify-between py-4 text-left"
          >
            <span className="font-semibold">{item.question}</span>
            <span className="text-xl">
              {openQuestion === item.question ? "−" : "+"}
            </span>
          </button>
          {openQuestion === item.question && (
            <div className="pb-4 text-muted-foreground">{item.answer}</div>
          )}
        </div>
      ))}
    </div>
  );
}
