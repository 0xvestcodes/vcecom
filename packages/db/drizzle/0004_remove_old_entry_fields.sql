-- Remove old fields from entries table after migration
-- This should be run after verifying data migration was successful

-- Step 1: Drop the old status index
DROP INDEX IF EXISTS "entries_status_idx";

-- Step 2: Remove old status and data columns
ALTER TABLE "entries" DROP COLUMN IF EXISTS "status";
ALTER TABLE "entries" DROP COLUMN IF EXISTS "data";

-- Step 3: Drop the old entry_status enum (only if not used elsewhere)
-- Note: Check if entry_status is used in other tables before dropping
-- DROP TYPE IF EXISTS "entry_status";
