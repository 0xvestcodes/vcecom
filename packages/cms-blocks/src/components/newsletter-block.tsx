"use client";

import { useState } from "react";
import type { BlockComponentProps } from "./types";
import { cn } from "./utils";

interface NewsletterBlockProps {
  title?: string;
  description?: string;
  placeholder?: string;
}

export function NewsletterBlock({
  props,
}: BlockComponentProps<NewsletterBlockProps>) {
  const {
    title = "Subscribe to our newsletter",
    description,
    placeholder = "Enter your email",
    style,
  } = props;
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const variantClasses = {
    default: "",
    inset: "bg-muted/50 p-4 rounded",
    card: "bg-card border rounded-lg p-6",
    section: "bg-accent/10 p-8 rounded-lg",
    ghost: "bg-transparent",
  } as const;

  const blockClasses = cn(
    "text-center",
    variantClasses[style?.variant || "default"],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, this would call an API
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className={blockClasses}>
        <p className="text-green-600">Thank you for subscribing!</p>
      </div>
    );
  }

  return (
    <div className={blockClasses}>
      {title ? <h2 className="mb-2 text-2xl font-bold">{title}</h2> : null}
      {description ? (
        <p className="mb-4 text-muted-foreground">{description}</p>
      ) : null}
      <form onSubmit={handleSubmit} className="mx-auto max-w-md">
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={placeholder}
            className="flex-1 rounded-md border px-4 py-2"
            required
          />
          <button
            type="submit"
            className="rounded-md bg-primary px-6 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Subscribe
          </button>
        </div>
      </form>
    </div>
  );
}
