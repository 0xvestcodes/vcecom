"use client";

import { useState } from "react";
import type { BlockComponentProps } from "./types";
import { cn } from "./utils";

interface ContactFormBlockProps {
  title?: string;
  fields?: string[];
}

export function ContactFormBlock({
  props,
}: BlockComponentProps<ContactFormBlockProps>) {
  const {
    title = "Contact Us",
    fields = ["name", "email", "message"],
    style,
  } = props;
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const variantClasses = {
    default: "",
    inset: "bg-muted/50 p-4 rounded",
    card: "bg-card border rounded-lg p-6",
    section: "bg-accent/10 p-8 rounded-lg",
    ghost: "bg-transparent",
  } as const;

  const blockClasses = cn(
    "max-w-md mx-auto",
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
        <p className="text-center text-green-600">
          Thank you! We'll get back to you soon.
        </p>
      </div>
    );
  }

  return (
    <div className={blockClasses}>
      {title ? <h2 className="mb-4 text-2xl font-bold">{title}</h2> : null}
      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.includes("name") && (
          <div>
            <label htmlFor="name" className="mb-2 block text-sm font-medium">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={formData.name || ""}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full rounded-md border px-4 py-2"
              required
            />
          </div>
        )}
        {fields.includes("email") && (
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={formData.email || ""}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full rounded-md border px-4 py-2"
              required
            />
          </div>
        )}
        {fields.includes("message") && (
          <div>
            <label htmlFor="message" className="mb-2 block text-sm font-medium">
              Message
            </label>
            <textarea
              id="message"
              value={formData.message || ""}
              onChange={(e) =>
                setFormData({ ...formData, message: e.target.value })
              }
              className="w-full rounded-md border px-4 py-2"
              rows={4}
              required
            />
          </div>
        )}
        <button
          type="submit"
          className="w-full rounded-md bg-primary px-6 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Send Message
        </button>
      </form>
    </div>
  );
}
