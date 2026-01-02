-- Data migration: Move existing entries to snapshots
-- This script migrates data from entries.data and entries.status to entry_snapshots

-- Step 1: Migrate all entries to draft snapshots
INSERT INTO "entry_snapshots" (
  "entry_id",
  "snapshot_type",
  "data",
  "snapshot_number",
  "created_at",
  "created_by"
)
SELECT
  "id" as "entry_id",
  'draft' as "snapshot_type",
  "data",
  0 as "snapshot_number",
  "created_at",
  "created_by"
FROM "entries"
WHERE "data" IS NOT NULL;

-- Step 2: Migrate published entries to published snapshots
INSERT INTO "entry_snapshots" (
  "entry_id",
  "snapshot_type",
  "data",
  "snapshot_number",
  "frozen_at",
  "created_at",
  "created_by"
)
SELECT
  "id" as "entry_id",
  'published' as "snapshot_type",
  "data",
  1 as "snapshot_number",
  COALESCE("published_at", "updated_at") as "frozen_at",
  COALESCE("published_at", "created_at") as "created_at",
  "updated_by" as "created_by"
FROM "entries"
WHERE "status" = 'published' AND "data" IS NOT NULL;

-- Step 3: Update workflow status based on old status
UPDATE "entries"
SET "current_workflow_status" = CASE
  WHEN "status" = 'published' THEN 'published'::workflow_status
  ELSE 'draft'::workflow_status
END;

-- Step 4: Freeze published snapshots (set frozen_at if not already set)
UPDATE "entry_snapshots"
SET "frozen_at" = "created_at"
WHERE "snapshot_type" = 'published' AND "frozen_at" IS NULL;
