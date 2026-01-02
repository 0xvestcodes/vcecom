/**
 * Human language constants for CMS actions
 * Replaces technical terms with natural, user-friendly language
 */

export const CMS_ACTION_LABELS = {
  submitForReview: "Move to Review",
  rejectReview: "Send Back",
  restoreRevision: "Undo to Previous Version",
  publish: "Publish",
  unpublish: "Unpublish",
  save: "Save",
  preview: "Preview",
  viewLive: "View on Storefront",
  approveAndPublish: "Approve & Publish",
  delete: "Delete",
  edit: "Edit",
  back: "Back",
} as const;

export const CMS_STATUS_LABELS = {
  draft: "Draft",
  review: "In Review",
  published: "Published",
} as const;

export const CMS_STATUS_DESCRIPTIONS = {
  draft: "This page is a draft and not visible to visitors",
  review: "This page is being reviewed before publishing",
  published: "This page is live and visible to visitors",
} as const;
