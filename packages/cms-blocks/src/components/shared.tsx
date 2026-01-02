import { cn } from "./utils";

export function BlockImage({
  src,
  alt,
  width,
  height,
  className,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="h-full w-full rounded-lg object-cover"
      />
    </div>
  );
}

/**
 * Render Lexical JSON content to HTML
 */
function renderLexicalContent(content: unknown): string {
  if (!content || typeof content !== "object") {
    return "";
  }

  const contentObj = content as Record<string, unknown>;
  // Lexical format: { root: { children: [...], type: "root" } }
  // Note: type may be missing in some Lexical formats
  const root = contentObj.root as Record<string, unknown> | undefined;
  if (!root || !Array.isArray(root.children)) {
    return "";
  }

  const renderNode = (node: unknown): string => {
    if (typeof node !== "object" || node === null) {
      return "";
    }

    const nodeObj = node as Record<string, unknown>;
    const type = nodeObj.type as string;
    const children = Array.isArray(nodeObj.children)
      ? nodeObj.children.map(renderNode).join("")
      : "";
    const text = (nodeObj.text as string) || "";
    const format = (nodeObj.format as number) || 0;
    const tag = (nodeObj.tag as string) || "";

    // Handle text nodes with formatting
    if (type === "text") {
      let formattedText = text;
      // Format flags: 1 = bold, 2 = italic, 4 = underline, 8 = strikethrough
      if (format & 1) formattedText = `<strong>${formattedText}</strong>`; // bold
      if (format & 2) formattedText = `<em>${formattedText}</em>`; // italic
      if (format & 4) formattedText = `<u>${formattedText}</u>`; // underline
      if (format & 8) formattedText = `<s>${formattedText}</s>`; // strikethrough
      return formattedText;
    }

    // Handle element nodes
    switch (type) {
      case "paragraph":
        return `<p>${children || text}</p>`;
      case "heading": {
        const headingTag = tag || "h1";
        return `<${headingTag}>${children || text}</${headingTag}>`;
      }
      case "quote":
        return `<blockquote>${children || text}</blockquote>`;
      case "bullet":
      case "bullet-list":
        return `<ul>${children}</ul>`;
      case "number":
      case "numbered-list":
        return `<ol>${children}</ol>`;
      case "listitem":
        return `<li>${children || text}</li>`;
      case "link": {
        const url = (nodeObj.url as string) || "";
        const title = (nodeObj.title as string) || "";
        const target = (nodeObj.target as string) || undefined;
        const rel = target === "_blank" ? "noopener noreferrer" : undefined;
        const targetAttr = target ? ` target="${target}"` : "";
        const relAttr = rel ? ` rel="${rel}"` : "";
        const titleAttr = title ? ` title="${title}"` : "";
        return `<a href="${url}" class="text-primary hover:underline"${targetAttr}${relAttr}${titleAttr}>${children || text}</a>`;
      }
      case "linebreak":
        return "<br/>";
      default:
        return children || text;
    }
  };

  return root.children.map(renderNode).join("");
}

export function BlockRichText({ content }: { content: unknown }) {
  if (!content) return null;

  // Handle string content (HTML or markdown)
  if (typeof content === "string") {
    return (
      <div
        className="prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  // Handle Lexical JSON format
  if (typeof content === "object" && content !== null) {
    const contentObj = content as Record<string, unknown>;

    // Check for Lexical format: { root: { children: [...] } }
    // Note: type property may be missing, so we check for children array instead
    if (contentObj.root && typeof contentObj.root === "object") {
      const root = contentObj.root as Record<string, unknown>;
      if (Array.isArray(root.children)) {
        const html = renderLexicalContent(content);
        return (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      }
    }
  }

  // Fallback: render as JSON string (for debugging)
  return (
    <div className="prose prose-sm max-w-none">
      <pre className="text-xs">{JSON.stringify(content, null, 2)}</pre>
    </div>
  );
}
