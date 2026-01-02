CREATE TYPE "public"."entity_type" AS ENUM('product', 'collection', 'cms_page');--> statement-breakpoint
CREATE TABLE "route_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"pattern" text NOT NULL,
	"redirect_to" text,
	"is_fallback" boolean DEFAULT false NOT NULL,
	"locale" text,
	"is_default_locale" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "theme_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid,
	"colors" jsonb NOT NULL,
	"section_padding" text DEFAULT 'md' NOT NULL,
	"global_radius" text DEFAULT 'md' NOT NULL,
	"typography" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "theme_settings_store_id_unique" UNIQUE("store_id")
);
--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "structure" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "theme_settings" ADD CONSTRAINT "theme_settings_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "route_registry_slug_idx" ON "route_registry" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "route_registry_entity_type_idx" ON "route_registry" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "route_registry_entity_id_idx" ON "route_registry" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "route_registry_pattern_idx" ON "route_registry" USING btree ("pattern");--> statement-breakpoint
CREATE INDEX "route_registry_locale_idx" ON "route_registry" USING btree ("locale");--> statement-breakpoint
CREATE INDEX "route_registry_slug_pattern_idx" ON "route_registry" USING btree ("slug","pattern");--> statement-breakpoint
CREATE INDEX "route_registry_fallback_idx" ON "route_registry" USING btree ("is_fallback");--> statement-breakpoint
CREATE INDEX "theme_settings_store_id_idx" ON "theme_settings" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "products_slug_idx" ON "products" USING btree ("slug");