import type { IOptions } from "sanitize-html";
import sanitizeHtml from "sanitize-html";

/**
 * Sanitize HTML content to prevent XSS attacks
 * Removes potentially dangerous HTML tags and attributes
 * @param html - HTML string to sanitize
 * @param options - Optional sanitization options
 * @returns Sanitized HTML string
 */
export function sanitize(html: string, options?: IOptions): string {
  const defaultOptions: IOptions = {
    allowedTags: [
      "b",
      "i",
      "em",
      "strong",
      "a",
      "p",
      "br",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "blockquote",
      "code",
      "pre",
    ],
    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "alt", "title"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      img: ["http", "https", "data"],
    },
    // Remove all script tags and event handlers
    disallowedTagsMode: "discard",
  };

  return sanitizeHtml(html, { ...defaultOptions, ...options });
}

/**
 * Strip all HTML tags from a string
 * Useful for plain text extraction
 * @param html - HTML string
 * @returns Plain text without HTML tags
 */
export function stripHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
  });
}

/**
 * Sanitize user input for safe display
 * Removes all HTML and returns plain text
 * @param input - User input string
 * @returns Sanitized plain text
 */
export function sanitizeUserInput(input: string): string {
  if (typeof input !== "string") {
    return String(input);
  }
  return stripHtml(input).trim();
}
