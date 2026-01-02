/**
 * CMS Configuration
 * Graph freeze mode and other CMS settings
 */

export enum GraphFreezeMode {
  STRICT = "strict",
  SHALLOW = "shallow",
  DEEP = "deep",
  LAZY = "lazy",
}

export interface CmsConfig {
  /**
   * Default graph freeze mode for publishing
   * - strict: All referenced entries must be published
   * - shallow: Only direct references frozen (default)
   * - deep: Recursive freeze of entire graph
   * - lazy: Auto-publish referenced entries if not published
   */
  defaultGraphFreezeMode: GraphFreezeMode;

  /**
   * Maximum depth for deep freeze mode
   */
  maxFreezeDepth: number;

  /**
   * Default unpublish mode
   * - hard_reject: Cannot unpublish if dependencies exist
   * - cascade: Unpublish all dependent entries
   * - fallback: Use previous published snapshot
   */
  defaultUnpublishMode: "hard_reject" | "cascade" | "fallback";

  /**
   * Edit lock duration in minutes
   */
  editLockDurationMinutes: number;

  /**
   * Soft lock duration in minutes (for system actions)
   */
  softLockDurationMinutes: number;
}

export const defaultCmsConfig: CmsConfig = {
  defaultGraphFreezeMode: GraphFreezeMode.SHALLOW,
  maxFreezeDepth: 10,
  defaultUnpublishMode: "hard_reject",
  editLockDurationMinutes: 10,
  softLockDurationMinutes: 1,
};
