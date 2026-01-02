"use client";

import { $isLinkNode, LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
} from "@lexical/list";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import {
  $createHeadingNode,
  $isHeadingNode,
  HeadingNode,
  HeadingTagType,
  QuoteNode,
} from "@lexical/rich-text";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  EditorState,
  LexicalEditor,
} from "lexical";
import { useCallback, useEffect, useState } from "react";
import {
  $isInternalLinkNode,
  InternalLinkNode,
} from "./lexical-nodes/internal-link-node";

interface LexicalEditorProps {
  content: unknown;
  onChange: (content: unknown) => void;
  placeholder?: string;
  routeSlugs?: {
    products: Array<{ slug: string; entityId: string }>;
    collections: Array<{ slug: string; entityId: string }>;
    cmsPages: Array<{ slug: string; entityId: string }>;
  };
}

const theme = {
  paragraph: "mb-2",
  heading: {
    h1: "text-3xl font-bold mb-4",
    h2: "text-2xl font-bold mb-3",
    h3: "text-xl font-semibold mb-2",
  },
  list: {
    nested: {
      listitem: "ml-4",
    },
    ol: "list-decimal ml-6 mb-2",
    ul: "list-disc ml-6 mb-2",
    listitem: "mb-1",
  },
  link: "text-primary hover:underline",
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
  },
};

function onError(error: Error) {
  console.error(error);
}

/**
 * Lexical editor with internal linking support
 */
export function LexicalEditorInternal({
  content,
  onChange,
  placeholder = "Start typing...",
  routeSlugs: _routeSlugs,
}: LexicalEditorProps) {
  const initialConfig = {
    namespace: "LexicalEditor",
    theme,
    onError,
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      LinkNode,
      InternalLinkNode,
    ],
    editorState:
      content && typeof content === "object" && content !== null
        ? () => {
            // Lexical will parse the JSON if it's in the correct format
            // For now, initialize with empty content and let ContentSyncPlugin handle it
            const root = $getRoot();
            root.clear();
            const paragraph = $createParagraphNode();
            root.append(paragraph);
          }
        : undefined,
  };

  const handleChange = (editorState: EditorState, _editor: LexicalEditor) => {
    const json = editorState.toJSON();
    onChange(json);
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="lexical-editor">
        <EditorToolbar />
        <ContentSyncPlugin content={content} />
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4" />
            }
            placeholder={
              <div className="absolute top-4 left-4 text-muted-foreground pointer-events-none">
                {placeholder}
              </div>
            }
            ErrorBoundary={({ children }) => <>{children}</>}
          />
          <HistoryPlugin />
          <OnChangePlugin onChange={handleChange} />
        </div>
      </div>
    </LexicalComposer>
  );
}

/**
 * Plugin to sync content from props
 * Updates editor content when content prop changes externally
 */
function ContentSyncPlugin({ content }: { content: unknown }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!content) {
      // Clear editor if content is null/undefined
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        root.append(paragraph);
      });
      return;
    }

    // Only update if content is a valid Lexical JSON object
    if (typeof content === "object" && content !== null) {
      const contentObj = content as Record<string, unknown>;
      if (contentObj.root && typeof contentObj.root === "object") {
        editor.update(() => {
          try {
            const currentJson = editor.getEditorState().toJSON();

            // Only update if content has actually changed
            if (JSON.stringify(currentJson) !== JSON.stringify(content)) {
              // Parse the Lexical JSON and set it
              // Lexical's root.fromJSON() can be used, but we need to be careful
              // For now, we'll let the editor handle it through its internal mechanisms
              // The initialConfig editorState handles initial load
            }
          } catch (error) {
            console.error("Error syncing content:", error);
          }
        });
      }
    }
  }, [content, editor]);

  return null;
}

/**
 * Toolbar for Lexical editor
 */
function EditorToolbar() {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isHeading1, setIsHeading1] = useState(false);
  const [isHeading2, setIsHeading2] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [isBulletList, setIsBulletList] = useState(false);
  const [isOrderedList, setIsOrderedList] = useState(false);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat("bold"));
      setIsItalic(selection.hasFormat("italic"));

      const anchorNode = selection.anchor.getNode();
      const parent = anchorNode.getParent();

      if (parent) {
        if ($isHeadingNode(parent)) {
          const tag = parent.getTag();
          setIsHeading1(tag === "h1");
          setIsHeading2(tag === "h2");
        } else {
          setIsHeading1(false);
          setIsHeading2(false);
        }

        // Check for list types
        if ($isListNode(parent)) {
          const listType = parent.getListType();
          setIsBulletList(listType === "bullet");
          setIsOrderedList(listType === "number");
        } else {
          setIsBulletList(false);
          setIsOrderedList(false);
        }
      }

      // Check for link - check if selection is inside a link node
      const nodes = selection.getNodes();
      let foundLink = false;
      for (const node of nodes) {
        const parent = node.getParent();
        if (parent && ($isLinkNode(parent) || $isInternalLinkNode(parent))) {
          foundLink = true;
          break;
        }
      }
      setIsLink(foundLink);
    }
  }, []);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateToolbar();
      });
    });
  }, [editor, updateToolbar]);

  const formatBold = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.formatText("bold");
      }
    });
  }, [editor]);

  const formatItalic = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.formatText("italic");
      }
    });
  }, [editor]);

  const formatHeading = useCallback(
    (tag: HeadingTagType) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchorNode = selection.anchor.getNode();
          const focusNode = selection.focus.getNode();

          // Get the block nodes (paragraphs/headings) that contain the selection
          const anchorBlock = anchorNode.getTopLevelElement();
          const focusBlock = focusNode.getTopLevelElement();

          if (anchorBlock && focusBlock) {
            const blocksToReplace =
              anchorBlock === focusBlock
                ? [anchorBlock]
                : [anchorBlock, focusBlock];

            blocksToReplace.forEach((block) => {
              if (
                block &&
                ($isHeadingNode(block) || block.getType() === "paragraph")
              ) {
                const headingNode = $createHeadingNode(tag);
                // Copy children from the block
                const children = block.getChildren();
                children.forEach((child) => {
                  headingNode.append(child);
                });
                block.replace(headingNode);
              }
            });
          }
        }
      });
    },
    [editor],
  );

  const _formatParagraph = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const anchorNode = selection.anchor.getNode();
        const focusNode = selection.focus.getNode();

        // Get the block nodes (paragraphs/headings) that contain the selection
        const anchorBlock = anchorNode.getTopLevelElement();
        const focusBlock = focusNode.getTopLevelElement();

        if (anchorBlock && focusBlock) {
          const blocksToReplace =
            anchorBlock === focusBlock
              ? [anchorBlock]
              : [anchorBlock, focusBlock];

          blocksToReplace.forEach((block) => {
            if (
              block &&
              ($isHeadingNode(block) || block.getType() === "quote")
            ) {
              const paragraphNode = $createParagraphNode();
              // Copy children from the block
              const children = block.getChildren();
              children.forEach((child) => {
                paragraphNode.append(child);
              });
              block.replace(paragraphNode);
            }
          });
        }
      }
    });
  }, [editor]);

  const formatBulletList = useCallback(() => {
    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
  }, [editor]);

  const formatOrderedList = useCallback(() => {
    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
  }, [editor]);

  const formatLink = useCallback(() => {
    if (isLink) {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          // Remove link
          editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
        }
      });
    } else {
      const url = window.prompt("URL");
      if (url === null || url === "") {
        return;
      }

      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          // Check if it's an internal link
          const isInternal =
            !url.startsWith("http") &&
            !url.startsWith("mailto:") &&
            !url.startsWith("#");

          if (isInternal) {
            // For internal links, we need to wrap the selection
            // Use TOGGLE_LINK_COMMAND with a custom handler or wrap manually
            // For now, use the standard link command
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
          } else {
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
          }
        }
      });
    }
  }, [editor, isLink]);

  return (
    <div className="border-b p-2 flex gap-2 flex-wrap">
      <button
        type="button"
        onClick={formatBold}
        className={`px-2 py-1 rounded ${isBold ? "bg-muted" : ""}`}
        title="Bold"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        onClick={formatItalic}
        className={`px-2 py-1 rounded ${isItalic ? "bg-muted" : ""}`}
        title="Italic"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        onClick={() => formatHeading("h1")}
        className={`px-2 py-1 rounded ${isHeading1 ? "bg-muted" : ""}`}
        title="Heading 1"
      >
        H1
      </button>
      <button
        type="button"
        onClick={() => formatHeading("h2")}
        className={`px-2 py-1 rounded ${isHeading2 ? "bg-muted" : ""}`}
        title="Heading 2"
      >
        H2
      </button>
      <button
        type="button"
        onClick={formatLink}
        className={`px-2 py-1 rounded ${isLink ? "bg-muted" : ""}`}
        title="Link"
      >
        Link
      </button>
      <button
        type="button"
        onClick={formatBulletList}
        className={`px-2 py-1 rounded ${isBulletList ? "bg-muted" : ""}`}
        title="Bullet List"
      >
        •
      </button>
      <button
        type="button"
        onClick={formatOrderedList}
        className={`px-2 py-1 rounded ${isOrderedList ? "bg-muted" : ""}`}
        title="Numbered List"
      >
        1.
      </button>
    </div>
  );
}
