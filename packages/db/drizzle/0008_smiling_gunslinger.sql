CREATE TYPE "public"."login_attempt_status" AS ENUM('SUCCESS', 'FAILED', 'BLOCKED');--> statement-breakpoint
CREATE TYPE "public"."security_alert_severity" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."security_alert_status" AS ENUM('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_POSITIVE');--> statement-breakpoint
CREATE TYPE "public"."blacklist_type" AS ENUM('email', 'phone', 'address');--> statement-breakpoint
CREATE TYPE "public"."velocity_check_type" AS ENUM('order', 'payment', 'return');--> statement-breakpoint
CREATE TYPE "public"."geo_rule_action" AS ENUM('BLOCK', 'WARN', 'REDIRECT');--> statement-breakpoint
CREATE TYPE "public"."geo_rule_type" AS ENUM('RESTRICTED', 'ALLOWED');--> statement-breakpoint
CREATE TYPE "public"."import_job_source" AS ENUM('csv', 'excel', 'json', 'shopify', 'api');--> statement-breakpoint
CREATE TYPE "public"."import_job_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."import_job_type" AS ENUM('products', 'categories', 'inventory', 'customers');--> statement-breakpoint
CREATE TYPE "public"."import_template_type" AS ENUM('products', 'categories', 'inventory', 'customers');--> statement-breakpoint
CREATE TYPE "public"."region_pricing_override_type" AS ENUM('FIXED', 'PERCENTAGE');--> statement-breakpoint
CREATE TYPE "public"."region_pricing_rule_type" AS ENUM('OVERRIDE', 'MARKUP');--> statement-breakpoint
CREATE TYPE "public"."tax_audit_event_type" AS ENUM('CALCULATION', 'OVERRIDE_APPLIED', 'EXEMPTION_APPLIED', 'RATE_RESOLVED', 'TAX_ENGINE_RUN', 'TAX_SNAPSHOT_CREATED', 'TAX_SNAPSHOT_USED', 'TAX_RULE_CHANGE', 'TAX_EXEMPTION_CHANGE', 'ORDER_TAX_FINALIZED', 'DRIFT_DETECTED');--> statement-breakpoint
CREATE TYPE "public"."tax_audit_severity" AS ENUM('INFO', 'WARNING', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."tax_exemption_type" AS ENUM('CUSTOMER_GROUP', 'CUSTOMER', 'CATEGORY', 'PRODUCT', 'VARIANT');--> statement-breakpoint
CREATE TYPE "public"."tax_rule_type" AS ENUM('CUSTOMER_GROUP', 'CUSTOMER', 'CATEGORY', 'PRODUCT', 'VARIANT');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'SECURITY';--> statement-breakpoint
CREATE TABLE "ip_reputation" (
	"ip_address" text PRIMARY KEY NOT NULL,
	"reputation_score" text NOT NULL,
	"is_datacenter" boolean DEFAULT false NOT NULL,
	"is_vpn" boolean DEFAULT false NOT NULL,
	"is_proxy" boolean DEFAULT false NOT NULL,
	"is_tor" boolean DEFAULT false NOT NULL,
	"country" text,
	"city" text,
	"asn" text,
	"organization" text,
	"risk_factors" jsonb,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jwt_secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"secret" text NOT NULL,
	"version" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"rotated_at" timestamp,
	CONSTRAINT "jwt_secrets_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid,
	"email" text NOT NULL,
	"status" "login_attempt_status" NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"device_id" text,
	"session_id" uuid,
	"failure_reason" text,
	"anomaly_score" text,
	"anomaly_flags" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid,
	"severity" "security_alert_severity" NOT NULL,
	"status" "security_alert_status" DEFAULT 'OPEN' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"alert_type" text NOT NULL,
	"risk_score" text,
	"metadata" jsonb,
	"acknowledged_by" uuid,
	"acknowledged_at" timestamp,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"decimal_places" integer DEFAULT 2 NOT NULL,
	"exchange_rate" real,
	"last_updated" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "currencies_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_currency" text NOT NULL,
	"to_currency" text NOT NULL,
	"rate" real NOT NULL,
	"source" text NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "exchange_rates_unique_pair" UNIQUE("from_currency","to_currency")
);
--> statement-breakpoint
CREATE TABLE "fraud_blacklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "blacklist_type" NOT NULL,
	"value" text NOT NULL,
	"reason" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fraud_risk_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"risk_score" integer DEFAULT 0 NOT NULL,
	"risk_factors" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fraud_risk_scores_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "fraud_velocity_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"check_type" "velocity_check_type" NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"window_start" timestamp NOT NULL,
	"window_end" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_location_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_address" text NOT NULL,
	"country" text,
	"country_code" text,
	"region" text,
	"region_code" text,
	"city" text,
	"postal_code" text,
	"latitude" real,
	"longitude" real,
	"timezone" text,
	"isp" text,
	"cached_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "geo_rule_type" NOT NULL,
	"countries" jsonb,
	"states" jsonb,
	"action" "geo_rule_action" DEFAULT 'WARN' NOT NULL,
	"redirect_url" text,
	"warning_message" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hsn_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hsn_code" text NOT NULL,
	"description" text,
	"gst_rate" real,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hsn_codes_hsn_code_unique" UNIQUE("hsn_code")
);
--> statement-breakpoint
CREATE TABLE "import_job_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_job_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"field" text,
	"value" text,
	"error_code" text NOT NULL,
	"error_message" text NOT NULL,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "import_job_type" NOT NULL,
	"source" "import_job_source" NOT NULL,
	"status" "import_job_status" DEFAULT 'pending' NOT NULL,
	"file_url" text,
	"total_rows" integer DEFAULT 0,
	"processed_rows" integer DEFAULT 0,
	"successful_rows" integer DEFAULT 0,
	"failed_rows" integer DEFAULT 0,
	"metadata" jsonb,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "import_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "import_template_type" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"columns" jsonb,
	"sample_data" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "region_pricing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "region_pricing_rule_type" NOT NULL,
	"countries" jsonb,
	"states" jsonb,
	"product_variant_id" uuid,
	"product_id" uuid,
	"category_id" uuid,
	"override_type" "region_pricing_override_type" NOT NULL,
	"override_value" real NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"event" "tax_audit_event_type" NOT NULL,
	"severity" "tax_audit_severity" DEFAULT 'INFO' NOT NULL,
	"cart_id" uuid,
	"checkout_id" uuid,
	"order_id" uuid,
	"customer_id" uuid,
	"product_id" uuid,
	"variant_id" uuid,
	"applied_tax_rules" jsonb,
	"applied_exemptions" jsonb,
	"resolved_gst_rate" real,
	"base_amount" real,
	"tax_amount" real,
	"calculation_details" jsonb,
	"snapshot_version" text,
	"rule_hash" text,
	"engine_version" text,
	"drift_details" jsonb,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "tax_exemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"exemption_type" "tax_exemption_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"exemption_reason" text,
	"certificate_number" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"rule_type" "tax_rule_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"gst_rate" real NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "store_id" uuid;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD COLUMN "signature" text;--> statement-breakpoint
ALTER TABLE "carts" ADD COLUMN "currency" text DEFAULT 'INR' NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "store_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "store_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "store_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "discounts" ADD COLUMN "store_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "store_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "currency" text DEFAULT 'INR' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fraud_risk_score_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "store_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "store_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_alerts" ADD CONSTRAINT "security_alerts_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_alerts" ADD CONSTRAINT "security_alerts_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_blacklists" ADD CONSTRAINT "fraud_blacklists_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_risk_scores" ADD CONSTRAINT "fraud_risk_scores_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_risk_scores" ADD CONSTRAINT "fraud_risk_scores_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_velocity_checks" ADD CONSTRAINT "fraud_velocity_checks_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_job_errors" ADD CONSTRAINT "import_job_errors_import_job_id_import_jobs_id_fk" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region_pricing_rules" ADD CONSTRAINT "region_pricing_rules_product_variant_id_product_variants_id_fk" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region_pricing_rules" ADD CONSTRAINT "region_pricing_rules_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region_pricing_rules" ADD CONSTRAINT "region_pricing_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ip_reputation_reputationScore" ON "ip_reputation" USING btree ("reputation_score");--> statement-breakpoint
CREATE INDEX "idx_ip_reputation_lastSeenAt" ON "ip_reputation" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "idx_jwt_secrets_version" ON "jwt_secrets" USING btree ("version");--> statement-breakpoint
CREATE INDEX "idx_jwt_secrets_isActive" ON "jwt_secrets" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_jwt_secrets_expiresAt" ON "jwt_secrets" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_login_attempts_adminId" ON "login_attempts" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "idx_login_attempts_email" ON "login_attempts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_login_attempts_status" ON "login_attempts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_login_attempts_ipAddress" ON "login_attempts" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "idx_login_attempts_createdAt" ON "login_attempts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_login_attempts_email_createdAt" ON "login_attempts" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "idx_security_alerts_adminId" ON "security_alerts" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "idx_security_alerts_severity" ON "security_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_security_alerts_status" ON "security_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_security_alerts_alertType" ON "security_alerts" USING btree ("alert_type");--> statement-breakpoint
CREATE INDEX "idx_security_alerts_createdAt" ON "security_alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "currencies_code_idx" ON "currencies" USING btree ("code");--> statement-breakpoint
CREATE INDEX "currencies_active_idx" ON "currencies" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "currencies_default_idx" ON "currencies" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "exchange_rates_from_currency_idx" ON "exchange_rates" USING btree ("from_currency");--> statement-breakpoint
CREATE INDEX "exchange_rates_to_currency_idx" ON "exchange_rates" USING btree ("to_currency");--> statement-breakpoint
CREATE INDEX "exchange_rates_currency_pair_idx" ON "exchange_rates" USING btree ("from_currency","to_currency");--> statement-breakpoint
CREATE INDEX "fraud_blacklists_type_idx" ON "fraud_blacklists" USING btree ("type");--> statement-breakpoint
CREATE INDEX "fraud_blacklists_value_idx" ON "fraud_blacklists" USING btree ("value");--> statement-breakpoint
CREATE INDEX "fraud_blacklists_type_value_idx" ON "fraud_blacklists" USING btree ("type","value");--> statement-breakpoint
CREATE INDEX "fraud_risk_scores_order_id_idx" ON "fraud_risk_scores" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "fraud_risk_scores_risk_score_idx" ON "fraud_risk_scores" USING btree ("risk_score");--> statement-breakpoint
CREATE INDEX "fraud_risk_scores_flagged_idx" ON "fraud_risk_scores" USING btree ("flagged");--> statement-breakpoint
CREATE INDEX "fraud_risk_scores_reviewed_by_idx" ON "fraud_risk_scores" USING btree ("reviewed_by");--> statement-breakpoint
CREATE INDEX "fraud_velocity_checks_customer_id_idx" ON "fraud_velocity_checks" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "fraud_velocity_checks_check_type_idx" ON "fraud_velocity_checks" USING btree ("check_type");--> statement-breakpoint
CREATE INDEX "fraud_velocity_checks_customer_type_idx" ON "fraud_velocity_checks" USING btree ("customer_id","check_type");--> statement-breakpoint
CREATE INDEX "fraud_velocity_checks_window_idx" ON "fraud_velocity_checks" USING btree ("window_start","window_end");--> statement-breakpoint
CREATE INDEX "geo_location_cache_ip_address_idx" ON "geo_location_cache" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "geo_location_cache_country_code_idx" ON "geo_location_cache" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "geo_location_cache_region_code_idx" ON "geo_location_cache" USING btree ("region_code");--> statement-breakpoint
CREATE INDEX "geo_location_cache_expires_at_idx" ON "geo_location_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "geo_rules_type_idx" ON "geo_rules" USING btree ("type");--> statement-breakpoint
CREATE INDEX "geo_rules_active_idx" ON "geo_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "geo_rules_priority_idx" ON "geo_rules" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "hsn_codes_hsn_code_idx" ON "hsn_codes" USING btree ("hsn_code");--> statement-breakpoint
CREATE INDEX "hsn_codes_active_idx" ON "hsn_codes" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "import_job_errors_import_job_id_idx" ON "import_job_errors" USING btree ("import_job_id");--> statement-breakpoint
CREATE INDEX "import_job_errors_row_number_idx" ON "import_job_errors" USING btree ("row_number");--> statement-breakpoint
CREATE INDEX "import_job_errors_error_code_idx" ON "import_job_errors" USING btree ("error_code");--> statement-breakpoint
CREATE INDEX "import_job_errors_created_at_idx" ON "import_job_errors" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "import_jobs_type_idx" ON "import_jobs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "import_jobs_status_idx" ON "import_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "import_jobs_source_idx" ON "import_jobs" USING btree ("source");--> statement-breakpoint
CREATE INDEX "import_jobs_created_by_idx" ON "import_jobs" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "import_jobs_created_at_idx" ON "import_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "import_templates_type_idx" ON "import_templates" USING btree ("type");--> statement-breakpoint
CREATE INDEX "import_templates_is_active_idx" ON "import_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "import_templates_type_version_idx" ON "import_templates" USING btree ("type","version");--> statement-breakpoint
CREATE INDEX "region_pricing_rules_type_idx" ON "region_pricing_rules" USING btree ("type");--> statement-breakpoint
CREATE INDEX "region_pricing_rules_variant_id_idx" ON "region_pricing_rules" USING btree ("product_variant_id");--> statement-breakpoint
CREATE INDEX "region_pricing_rules_product_id_idx" ON "region_pricing_rules" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "region_pricing_rules_category_id_idx" ON "region_pricing_rules" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "region_pricing_rules_active_idx" ON "region_pricing_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "region_pricing_rules_priority_idx" ON "region_pricing_rules" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "region_pricing_rules_start_date_idx" ON "region_pricing_rules" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "region_pricing_rules_end_date_idx" ON "region_pricing_rules" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "tax_audit_logs_timestamp_idx" ON "tax_audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "tax_audit_logs_event_idx" ON "tax_audit_logs" USING btree ("event");--> statement-breakpoint
CREATE INDEX "tax_audit_logs_severity_idx" ON "tax_audit_logs" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "tax_audit_logs_cart_id_idx" ON "tax_audit_logs" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "tax_audit_logs_checkout_id_idx" ON "tax_audit_logs" USING btree ("checkout_id");--> statement-breakpoint
CREATE INDEX "tax_audit_logs_order_id_idx" ON "tax_audit_logs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "tax_audit_logs_customer_id_idx" ON "tax_audit_logs" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "tax_audit_logs_product_id_idx" ON "tax_audit_logs" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "tax_audit_logs_variant_id_idx" ON "tax_audit_logs" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "tax_audit_logs_rule_hash_idx" ON "tax_audit_logs" USING btree ("rule_hash");--> statement-breakpoint
CREATE INDEX "tax_exemptions_exemption_type_idx" ON "tax_exemptions" USING btree ("exemption_type");--> statement-breakpoint
CREATE INDEX "tax_exemptions_entity_id_idx" ON "tax_exemptions" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "tax_exemptions_active_idx" ON "tax_exemptions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "tax_exemptions_start_date_idx" ON "tax_exemptions" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "tax_exemptions_end_date_idx" ON "tax_exemptions" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "tax_exemptions_certificate_number_idx" ON "tax_exemptions" USING btree ("certificate_number");--> statement-breakpoint
CREATE INDEX "tax_exemptions_exemption_type_entity_idx" ON "tax_exemptions" USING btree ("exemption_type","entity_id");--> statement-breakpoint
CREATE INDEX "tax_rules_rule_type_idx" ON "tax_rules" USING btree ("rule_type");--> statement-breakpoint
CREATE INDEX "tax_rules_entity_id_idx" ON "tax_rules" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "tax_rules_priority_idx" ON "tax_rules" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "tax_rules_active_idx" ON "tax_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "tax_rules_start_date_idx" ON "tax_rules" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "tax_rules_end_date_idx" ON "tax_rules" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "tax_rules_rule_type_entity_idx" ON "tax_rules" USING btree ("rule_type","entity_id");--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_fraud_risk_score_id_fraud_risk_scores_id_fk" FOREIGN KEY ("fraud_risk_score_id") REFERENCES "public"."fraud_risk_scores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_store_id_idx" ON "addresses" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "categories_store_id_idx" ON "categories" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "categories_store_id_slug_idx" ON "categories" USING btree ("store_id","slug");--> statement-breakpoint
CREATE INDEX "collections_store_id_idx" ON "collections" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "collections_store_id_slug_idx" ON "collections" USING btree ("store_id","slug");--> statement-breakpoint
CREATE INDEX "customers_store_id_idx" ON "customers" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "customers_store_id_email_idx" ON "customers" USING btree ("store_id","email");--> statement-breakpoint
CREATE INDEX "discounts_store_id_idx" ON "discounts" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "discounts_store_id_code_idx" ON "discounts" USING btree ("store_id","code");--> statement-breakpoint
CREATE INDEX "order_items_store_id_idx" ON "order_items" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "orders_fraud_risk_score_id_idx" ON "orders" USING btree ("fraud_risk_score_id");--> statement-breakpoint
CREATE INDEX "products_store_id_idx" ON "products" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "products_store_id_slug_idx" ON "products" USING btree ("store_id","slug");