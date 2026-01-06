-- Create enums for abandoned cart system
CREATE TYPE "public"."cart_activity_type" AS ENUM('item_added', 'item_removed', 'quantity_updated', 'cart_viewed', 'checkout_started', 'discount_applied', 'discount_removed');--> statement-breakpoint
CREATE TYPE "public"."recovery_status" AS ENUM('queued', 'email_sent', 'sms_sent', 'recovered', 'expired', 'failed');--> statement-breakpoint

-- Create cart_activities table
CREATE TABLE "cart_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"customer_id" uuid,
	"session_id" text,
	"activity_type" "cart_activity_type" NOT NULL,
	"metadata" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Create customer_sessions table
CREATE TABLE "customer_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"customer_id" uuid,
	"cart_id" uuid,
	"ip_address" text,
	"user_agent" text,
	"device_type" text,
	"browser" text,
	"os" text,
	"country" text,
	"city" text,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "customer_sessions_session_id_unique" UNIQUE("session_id")
);--> statement-breakpoint

-- Create abandoned_cart_recoveries table
CREATE TABLE "abandoned_cart_recoveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"customer_id" uuid,
	"session_id" text,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"recovery_status" "recovery_status" DEFAULT 'queued' NOT NULL,
	"email_sent_at" timestamp,
	"sms_sent_at" timestamp,
	"recovered_at" timestamp,
	"recovery_discount_code" text,
	"recovery_attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp,
	"metadata" jsonb
);--> statement-breakpoint

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "cart_activities" ADD CONSTRAINT "cart_activities_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cart_activities" ADD CONSTRAINT "cart_activities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "abandoned_cart_recoveries" ADD CONSTRAINT "abandoned_cart_recoveries_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "abandoned_cart_recoveries" ADD CONSTRAINT "abandoned_cart_recoveries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Create indexes
CREATE INDEX IF NOT EXISTS "cart_activities_cart_id_idx" ON "cart_activities" ("cart_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cart_activities_customer_id_idx" ON "cart_activities" ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cart_activities_session_id_idx" ON "cart_activities" ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cart_activities_created_at_idx" ON "cart_activities" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cart_activities_activity_type_idx" ON "cart_activities" ("activity_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_sessions_session_id_idx" ON "customer_sessions" ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_sessions_customer_id_idx" ON "customer_sessions" ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_sessions_cart_id_idx" ON "customer_sessions" ("cart_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_sessions_last_seen_at_idx" ON "customer_sessions" ("last_seen_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_sessions_is_active_idx" ON "customer_sessions" ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "abandoned_cart_recoveries_cart_id_idx" ON "abandoned_cart_recoveries" ("cart_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "abandoned_cart_recoveries_customer_id_idx" ON "abandoned_cart_recoveries" ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "abandoned_cart_recoveries_recovery_status_idx" ON "abandoned_cart_recoveries" ("recovery_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "abandoned_cart_recoveries_detected_at_idx" ON "abandoned_cart_recoveries" ("detected_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "abandoned_cart_recoveries_next_attempt_at_idx" ON "abandoned_cart_recoveries" ("next_attempt_at");--> statement-breakpoint
