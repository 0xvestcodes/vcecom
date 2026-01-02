CREATE TYPE "public"."workflow_status" AS ENUM('draft', 'review', 'published');--> statement-breakpoint
CREATE TYPE "public"."snapshot_type" AS ENUM('draft', 'review', 'published');--> statement-breakpoint
CREATE TYPE "public"."lock_type" AS ENUM('hard', 'soft');--> statement-breakpoint
CREATE TABLE "entry_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"snapshot_type" "snapshot_type" NOT NULL,
	"data" jsonb NOT NULL,
	"snapshot_number" integer DEFAULT 0 NOT NULL,
	"frozen_at" timestamp,
	"frozen_references" jsonb,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "entry_edit_locks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"locked_by" uuid NOT NULL,
	"lock_type" "lock_type" NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slug_redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"old_slug" text NOT NULL,
	"new_slug" text NOT NULL,
	"snapshot_number" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "current_workflow_status" "workflow_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "entry_snapshots" ADD CONSTRAINT "entry_snapshots_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_snapshots" ADD CONSTRAINT "entry_snapshots_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_snapshots" ADD CONSTRAINT "entry_snapshots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_edit_locks" ADD CONSTRAINT "entry_edit_locks_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_edit_locks" ADD CONSTRAINT "entry_edit_locks_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slug_redirects" ADD CONSTRAINT "slug_redirects_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entry_snapshots_entry_id_idx" ON "entry_snapshots" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "entry_snapshots_snapshot_type_idx" ON "entry_snapshots" USING btree ("snapshot_type");--> statement-breakpoint
CREATE INDEX "entry_snapshots_entry_number_idx" ON "entry_snapshots" USING btree ("entry_id","snapshot_number");--> statement-breakpoint
CREATE INDEX "entry_snapshots_frozen_at_idx" ON "entry_snapshots" USING btree ("frozen_at");--> statement-breakpoint
CREATE INDEX "entry_edit_locks_entry_id_idx" ON "entry_edit_locks" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "entry_edit_locks_expires_at_idx" ON "entry_edit_locks" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "entry_edit_locks_entry_id_unique" ON "entry_edit_locks" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "slug_redirects_entry_id_idx" ON "slug_redirects" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "slug_redirects_old_slug_idx" ON "slug_redirects" USING btree ("old_slug");--> statement-breakpoint
CREATE INDEX "slug_redirects_entry_old_slug_idx" ON "slug_redirects" USING btree ("entry_id","old_slug");--> statement-breakpoint
CREATE INDEX "entries_workflow_status_idx" ON "entries" USING btree ("current_workflow_status");--> statement-breakpoint
-- Partial unique index: one draft and one review snapshot per entry
CREATE UNIQUE INDEX "entry_snapshots_entry_type_unique" ON "entry_snapshots" USING btree ("entry_id", "snapshot_type") WHERE "snapshot_type" IN ('draft', 'review');