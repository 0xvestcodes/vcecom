CREATE TYPE "public"."entry_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."relation_type" AS ENUM('one_to_one', 'one_to_many', 'many_to_many');--> statement-breakpoint
CREATE TYPE "public"."timeline_event_type" AS ENUM('order_created', 'order_confirmed', 'order_processing', 'order_shipped', 'order_delivered', 'order_cancelled', 'status_changed', 'payment_intent_created', 'payment_initiated', 'payment_completed', 'payment_failed', 'order_marked_paid', 'cart_snapshot', 'inventory_reserved', 'shipment_created', 'shipment_tracking_updated', 'shipment_label_generated', 'shipment_picked_up', 'shipment_in_transit', 'shipment_out_for_delivery', 'shipment_delivered', 'shipment_failed', 'shipment_returned', 'shipment_cancelled', 'note_added', 'admin_note_added', 'address_updated', 'refund_created', 'refund_processed', 'rate_limit_triggered', 'checkout_merged', 'guest_checkout_detected', 'abandoned_checkout_recovered');--> statement-breakpoint
CREATE TABLE "content_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"schema" jsonb NOT NULL,
	"is_singleton" boolean DEFAULT false NOT NULL,
	"is_collection" boolean DEFAULT true NOT NULL,
	"icon" text,
	"color" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "content_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type_id" uuid NOT NULL,
	"status" "entry_status" DEFAULT 'draft' NOT NULL,
	"data" jsonb NOT NULL,
	"slug" text,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "entry_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "entry_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_entry_id" uuid NOT NULL,
	"target_entry_id" uuid NOT NULL,
	"relation_type" "relation_type" NOT NULL,
	"field_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_timeline" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"type" timeline_event_type NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"actor" text,
	"actor_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_types" ADD CONSTRAINT "content_types_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_types" ADD CONSTRAINT "content_types_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_content_type_id_content_types_id_fk" FOREIGN KEY ("content_type_id") REFERENCES "public"."content_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_revisions" ADD CONSTRAINT "entry_revisions_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_revisions" ADD CONSTRAINT "entry_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_relations" ADD CONSTRAINT "entry_relations_source_entry_id_entries_id_fk" FOREIGN KEY ("source_entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_relations" ADD CONSTRAINT "entry_relations_target_entry_id_entries_id_fk" FOREIGN KEY ("target_entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_timeline" ADD CONSTRAINT "order_timeline_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_types_name_idx" ON "content_types" USING btree ("name");--> statement-breakpoint
CREATE INDEX "content_types_created_at_idx" ON "content_types" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "entries_content_type_id_idx" ON "entries" USING btree ("content_type_id");--> statement-breakpoint
CREATE INDEX "entries_status_idx" ON "entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "entries_published_at_idx" ON "entries" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "entries_slug_idx" ON "entries" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "entries_content_type_slug_idx" ON "entries" USING btree ("content_type_id","slug");--> statement-breakpoint
CREATE INDEX "entry_revisions_entry_id_idx" ON "entry_revisions" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "entry_revisions_entry_revision_idx" ON "entry_revisions" USING btree ("entry_id","revision_number");--> statement-breakpoint
CREATE INDEX "entry_relations_source_entry_id_idx" ON "entry_relations" USING btree ("source_entry_id");--> statement-breakpoint
CREATE INDEX "entry_relations_target_entry_id_idx" ON "entry_relations" USING btree ("target_entry_id");--> statement-breakpoint
CREATE INDEX "entry_relations_source_field_idx" ON "entry_relations" USING btree ("source_entry_id","field_name");--> statement-breakpoint
CREATE INDEX "order_timeline_order_id_idx" ON "order_timeline" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_timeline_type_idx" ON "order_timeline" USING btree ("type");--> statement-breakpoint
CREATE INDEX "order_timeline_timestamp_idx" ON "order_timeline" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "order_timeline_order_id_timestamp_idx" ON "order_timeline" USING btree ("order_id","timestamp");