-- Drop content registry tables (content registry system removed)
-- Blog posts table is kept as it's a separate feature

-- Drop indexes first
DROP INDEX IF EXISTS "content_registry_store_id_idx";
DROP INDEX IF EXISTS "content_registry_key_idx";
DROP INDEX IF EXISTS "content_schemas_store_id_idx";

-- Drop foreign key constraints
ALTER TABLE "content_registry" DROP CONSTRAINT IF EXISTS "content_registry_store_id_stores_id_fk";
ALTER TABLE "content_registry" DROP CONSTRAINT IF EXISTS "content_registry_updated_by_users_id_fk";
ALTER TABLE "content_schemas" DROP CONSTRAINT IF EXISTS "content_schemas_store_id_stores_id_fk";

-- Drop tables
DROP TABLE IF EXISTS "content_registry";
DROP TABLE IF EXISTS "content_schemas";
