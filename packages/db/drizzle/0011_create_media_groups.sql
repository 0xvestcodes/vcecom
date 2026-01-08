CREATE TABLE "media_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "media_groups_name_unique" UNIQUE("name"),
	CONSTRAINT "media_groups_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "media_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"alt_text" text,
	"caption" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"link_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE INDEX "media_groups_name_idx" ON "media_groups" USING btree ("name");--> statement-breakpoint
CREATE INDEX "media_groups_slug_idx" ON "media_groups" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "media_groups_is_active_idx" ON "media_groups" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "media_groups_display_order_idx" ON "media_groups" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "media_items_group_id_idx" ON "media_items" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "media_items_group_id_display_order_idx" ON "media_items" USING btree ("group_id", "display_order");--> statement-breakpoint
CREATE INDEX "media_items_is_active_idx" ON "media_items" USING btree ("is_active");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_groups" ADD CONSTRAINT "media_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_groups" ADD CONSTRAINT "media_groups_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_items" ADD CONSTRAINT "media_items_group_id_media_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."media_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_items" ADD CONSTRAINT "media_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_items" ADD CONSTRAINT "media_items_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
