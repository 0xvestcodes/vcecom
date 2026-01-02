ALTER TYPE "public"."payment_method" ADD VALUE 'cashfree' BEFORE 'bnpl';--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'cashfree_upi' BEFORE 'bnpl';--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'cashfree_card' BEFORE 'bnpl';--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'payu' BEFORE 'bnpl';--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'payu_upi' BEFORE 'bnpl';--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'payu_card' BEFORE 'bnpl';--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'payu_netbanking' BEFORE 'bnpl';--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'payu_wallet' BEFORE 'bnpl';--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"featured_image" text,
	"content" text NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"seo" jsonb,
	CONSTRAINT "blog_posts_store_slug_unique" UNIQUE("store_id","slug")
);
--> statement-breakpoint
CREATE TABLE "content_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"key" text NOT NULL,
	"data" jsonb NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "content_registry_store_key_unique" UNIQUE("store_id","key")
);
--> statement-breakpoint
CREATE TABLE "content_schemas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"schema" jsonb NOT NULL,
	"version" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "content_schemas_store_id_unique" UNIQUE("store_id")
);
--> statement-breakpoint
CREATE TABLE "themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"theme_id" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "theme_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cashfree_order_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payu_txn_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "cashfree_payment_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "cashfree_order_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "payu_payment_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "payu_txn_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "payment_gateway" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_registry" ADD CONSTRAINT "content_registry_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_registry" ADD CONSTRAINT "content_registry_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_schemas" ADD CONSTRAINT "content_schemas_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blog_posts_store_id_idx" ON "blog_posts" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "blog_posts_slug_idx" ON "blog_posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "blog_posts_published_idx" ON "blog_posts" USING btree ("published");--> statement-breakpoint
CREATE INDEX "blog_posts_published_at_idx" ON "blog_posts" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "blog_posts_created_at_idx" ON "blog_posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "content_registry_store_id_idx" ON "content_registry" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "content_registry_key_idx" ON "content_registry" USING btree ("key");--> statement-breakpoint
CREATE INDEX "content_schemas_store_id_idx" ON "content_schemas" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "themes_store_id_idx" ON "themes" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "themes_theme_id_idx" ON "themes" USING btree ("theme_id");--> statement-breakpoint
CREATE INDEX "themes_is_active_idx" ON "themes" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "themes_store_theme_idx" ON "themes" USING btree ("store_id","theme_id");--> statement-breakpoint
CREATE INDEX "orders_cashfree_order_id_idx" ON "orders" USING btree ("cashfree_order_id");--> statement-breakpoint
CREATE INDEX "orders_payu_txn_id_idx" ON "orders" USING btree ("payu_txn_id");--> statement-breakpoint
CREATE INDEX "payments_cashfree_payment_id_idx" ON "payments" USING btree ("cashfree_payment_id");--> statement-breakpoint
CREATE INDEX "payments_cashfree_order_id_idx" ON "payments" USING btree ("cashfree_order_id");--> statement-breakpoint
CREATE INDEX "payments_payu_payment_id_idx" ON "payments" USING btree ("payu_payment_id");--> statement-breakpoint
CREATE INDEX "payments_payu_txn_id_idx" ON "payments" USING btree ("payu_txn_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cashfree_order_id_unique" UNIQUE("cashfree_order_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_payu_txn_id_unique" UNIQUE("payu_txn_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_cashfree_payment_id_unique" UNIQUE("cashfree_payment_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payu_payment_id_unique" UNIQUE("payu_payment_id");