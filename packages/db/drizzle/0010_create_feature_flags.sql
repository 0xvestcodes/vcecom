CREATE TYPE "public"."feature_flag_type" AS ENUM('global', 'store', 'admin', 'env');--> statement-breakpoint
CREATE TYPE "public"."feature_flag_scope_type" AS ENUM('admin', 'store', 'environment');--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"description" text NOT NULL,
	"type" "feature_flag_type" DEFAULT 'global' NOT NULL,
	"default_state" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "feature_flags_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "feature_flag_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature_key" text NOT NULL,
	"scope_type" "feature_flag_scope_type" NOT NULL,
	"scope_id" text NOT NULL,
	"state" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flag_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature_key" text NOT NULL,
	"scope_type" "feature_flag_scope_type",
	"scope_id" text,
	"old_state" boolean,
	"new_state" boolean NOT NULL,
	"changed_by" uuid NOT NULL,
	"change_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flag_overrides" ADD CONSTRAINT "feature_flag_overrides_feature_key_feature_flags_key_fk" FOREIGN KEY ("feature_key") REFERENCES "public"."feature_flags"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flag_overrides" ADD CONSTRAINT "feature_flag_overrides_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flag_audit_logs" ADD CONSTRAINT "feature_flag_audit_logs_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feature_flags_key_idx" ON "feature_flags" USING btree ("key");--> statement-breakpoint
CREATE INDEX "feature_flags_type_idx" ON "feature_flags" USING btree ("type");--> statement-breakpoint
CREATE INDEX "feature_flag_overrides_feature_key_scope_idx" ON "feature_flag_overrides" USING btree ("feature_key", "scope_type", "scope_id");--> statement-breakpoint
CREATE INDEX "feature_flag_overrides_feature_key_idx" ON "feature_flag_overrides" USING btree ("feature_key");--> statement-breakpoint
CREATE INDEX "feature_flag_overrides_scope_idx" ON "feature_flag_overrides" USING btree ("scope_type", "scope_id");--> statement-breakpoint
CREATE INDEX "feature_flag_audit_logs_feature_key_idx" ON "feature_flag_audit_logs" USING btree ("feature_key");--> statement-breakpoint
CREATE INDEX "feature_flag_audit_logs_created_at_idx" ON "feature_flag_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "feature_flag_audit_logs_changed_by_idx" ON "feature_flag_audit_logs" USING btree ("changed_by");
