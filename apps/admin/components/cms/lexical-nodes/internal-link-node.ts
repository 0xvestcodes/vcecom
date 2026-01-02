import { LinkNode, SerializedLinkNode } from "@lexical/link";
import {
  $applyNodeReplacement,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  Spread,
} from "lexical";

export interface InternalLinkPayload {
  url: string;
  entityType?: "product" | "collection" | "cms_page";
  entityId?: string;
  target?: string | null;
  key?: NodeKey;
}

export type SerializedInternalLinkNode = Spread<
  {
    entityType?: "product" | "collection" | "cms_page";
    entityId?: string;
  },
  SerializedLinkNode
>;

/**
 * Internal link node for Lexical
 * Extends LinkNode to support internal links with entity references
 */
export class InternalLinkNode extends LinkNode {
  __entityType?: "product" | "collection" | "cms_page";
  __entityId?: string;

  static getType(): string {
    return "internalLink";
  }

  static clone(node: InternalLinkNode): InternalLinkNode {
    return new InternalLinkNode(node.__url, {
      url: node.__url,
      entityType: node.__entityType,
      entityId: node.__entityId,
      target: node.__target,
      key: node.__key,
    });
  }

  constructor(
    url: string,
    { entityType, entityId, target, key }: InternalLinkPayload,
  ) {
    super(url, { target });
    if (key) {
      // Lexical's internal key assignment
      (this as unknown as { __key: NodeKey }).__key = key;
    }
    this.__entityType = entityType;
    this.__entityId = entityId;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = super.createDOM(config);
    if (this.__entityType) {
      element.setAttribute("data-entity-type", this.__entityType);
    }
    if (this.__entityId) {
      element.setAttribute("data-entity-id", this.__entityId);
    }
    element.classList.add("internal-link");
    return element;
  }

  updateDOM(
    prevNode: InternalLinkNode,
    dom: HTMLElement,
    config: EditorConfig,
  ): boolean {
    const updated = super.updateDOM(prevNode, dom, config);
    if (this.__entityType !== prevNode.__entityType) {
      if (this.__entityType) {
        dom.setAttribute("data-entity-type", this.__entityType);
      } else {
        dom.removeAttribute("data-entity-type");
      }
    }
    if (this.__entityId !== prevNode.__entityId) {
      if (this.__entityId) {
        dom.setAttribute("data-entity-id", this.__entityId);
      } else {
        dom.removeAttribute("data-entity-id");
      }
    }
    return updated;
  }

  static importDOM(): DOMConversionMap | null {
    return {
      a: (_node: Node) => ({
        conversion: convertAnchorElement,
        priority: 1,
      }),
    };
  }

  static importJSON(
    serializedNode: SerializedInternalLinkNode,
  ): InternalLinkNode {
    const { url, entityType, entityId, target } = serializedNode;
    const node = $createInternalLinkNode(url, {
      entityType,
      entityId,
      target: target || undefined,
    });
    return node;
  }

  exportJSON(): SerializedInternalLinkNode {
    return {
      ...super.exportJSON(),
      entityType: this.__entityType,
      entityId: this.__entityId,
      type: "internalLink",
    };
  }

  exportDOM(_editor: LexicalEditor | null | undefined): DOMExportOutput {
    if (!_editor) {
      throw new Error("Editor is required for exportDOM");
    }
    const result = super.exportDOM(_editor);
    const element = result.element;
    if (element && element instanceof HTMLElement) {
      if (this.__entityType) {
        element.setAttribute("data-entity-type", this.__entityType);
      }
      if (this.__entityId) {
        element.setAttribute("data-entity-id", this.__entityId);
      }
    }
    return result;
  }

  getEntityType(): "product" | "collection" | "cms_page" | undefined {
    return this.__entityType;
  }

  getEntityId(): string | undefined {
    return this.__entityId;
  }

  setEntityType(
    entityType: "product" | "collection" | "cms_page" | undefined,
  ): void {
    const writable = this.getWritable();
    writable.__entityType = entityType;
  }

  setEntityId(entityId: string | undefined): void {
    const writable = this.getWritable();
    writable.__entityId = entityId;
  }
}

function convertAnchorElement(domNode: Node): DOMConversionOutput {
  const node = domNode as HTMLAnchorElement;
  const url = node.getAttribute("href") || "";
  const entityType = node.getAttribute("data-entity-type") as
    | "product"
    | "collection"
    | "cms_page"
    | null;
  const entityId = node.getAttribute("data-entity-id") || undefined;
  const target = node.getAttribute("target") || undefined;

  // Check if it's an internal link (not http/https/mailto)
  if (
    url &&
    !url.startsWith("http") &&
    !url.startsWith("mailto:") &&
    !url.startsWith("#")
  ) {
    const linkNode = $createInternalLinkNode(url, {
      entityType: entityType || undefined,
      entityId,
      target,
    });
    return { node: linkNode };
  }

  // For external links, return false to let LinkNode handle it
  return { node: null };
}

export function $createInternalLinkNode(
  url: string,
  {
    entityType,
    entityId,
    target,
  }: {
    entityType?: "product" | "collection" | "cms_page";
    entityId?: string;
    target?: string | null;
  } = {},
): InternalLinkNode {
  return $applyNodeReplacement(
    new InternalLinkNode(url, { url, entityType, entityId, target }),
  );
}

export function $isInternalLinkNode(
  node: LexicalNode | null | undefined,
): node is InternalLinkNode {
  return node instanceof InternalLinkNode;
}
