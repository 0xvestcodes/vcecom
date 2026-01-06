CREATE TYPE "public"."recovery_status" AS ENUM('queued', 'email_sent', 'sms_sent', 'recovered', 'expired', 'failed');--> statement-breakpoint
CREATE TYPE "public"."cart_activity_type" AS ENUM('item_added', 'item_removed', 'quantity_updated', 'cart_viewed', 'checkout_started', 'discount_applied', 'discount_removed');--> statement-breakpoint
CREATE TYPE "public"."tax_display_type" AS ENUM('INCLUSIVE', 'EXCLUSIVE');--> statement-breakpoint
CREATE TYPE "public"."loyalty_rule_calculation_type" AS ENUM('percentage', 'fixed', 'tiered');--> statement-breakpoint
CREATE TYPE "public"."loyalty_rule_type" AS ENUM('earning', 'redemption');--> statement-breakpoint
CREATE TYPE "public"."refund_reconciliation_status" AS ENUM('pending', 'reconciled', 'mismatch', 'failed');--> statement-breakpoint
CREATE TYPE "public"."return_item_condition" AS ENUM('new', 'damaged', 'defective', 'other');--> statement-breakpoint
CREATE TYPE "public"."return_item_status" AS ENUM('pending', 'approved', 'rejected', 'received', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."return_request_status" AS ENUM('pending', 'approved', 'rejected', 'in_transit', 'received', 'processing_refund', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."index_status" AS ENUM('pending', 'indexed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."wallet_transaction_type" AS ENUM('credit', 'debit', 'points_earned', 'points_redeemed', 'refund', 'admin_adjustment', 'promotion');--> statement-breakpoint
CREATE TYPE "public"."webhook_delivery_status" AS ENUM('pending', 'success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."incoming_webhook_provider" AS ENUM('razorpay', 'shiprocket', 'nimbus_post', 'generic');--> statement-breakpoint
CREATE TYPE "public"."incoming_webhook_status" AS ENUM('pending', 'processed', 'failed');--> statement-breakpoint
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
);
--> statement-breakpoint
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
);
--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE TABLE "customer_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"wallet_balance" real DEFAULT 0 NOT NULL,
	"loyalty_points" integer DEFAULT 0 NOT NULL,
	"total_earned" real DEFAULT 0 NOT NULL,
	"total_redeemed" real DEFAULT 0 NOT NULL,
	"total_points_earned" integer DEFAULT 0 NOT NULL,
	"total_points_redeemed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_wallets_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "loyalty_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "loyalty_rule_type" NOT NULL,
	"rule_type" "loyalty_rule_calculation_type" NOT NULL,
	"points_per_rupee" real DEFAULT 0 NOT NULL,
	"rupees_per_point" real DEFAULT 0 NOT NULL,
	"min_order_value" real DEFAULT 0 NOT NULL,
	"min_points_to_redeem" integer DEFAULT 0 NOT NULL,
	"max_points_per_order" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"valid_from" timestamp DEFAULT now() NOT NULL,
	"valid_until" timestamp,
	"customer_group_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund_reconciliation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"refund_id" uuid NOT NULL,
	"provider_refund_id" text NOT NULL,
	"gateway" text NOT NULL,
	"expected_amount" real NOT NULL,
	"actual_amount" real,
	"status" "refund_reconciliation_status" DEFAULT 'pending' NOT NULL,
	"reconciled_at" timestamp,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_eligibility_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"conditions" jsonb NOT NULL,
	"max_days_after_delivery" integer,
	"allowed_reasons" jsonb,
	"excluded_categories" jsonb,
	"excluded_products" jsonb,
	"min_order_value" real,
	"max_returns_per_customer" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_request_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"reason" text NOT NULL,
	"condition" "return_item_condition" DEFAULT 'other' NOT NULL,
	"refund_amount" real DEFAULT 0 NOT NULL,
	"status" "return_item_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"rma_number" text NOT NULL,
	"status" "return_request_status" DEFAULT 'pending' NOT NULL,
	"reason" text NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	"approved_by" uuid,
	"rejection_reason" text,
	"return_address_id" uuid,
	"tracking_number" text,
	"received_at" timestamp,
	"completed_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "return_requests_rma_number_unique" UNIQUE("rma_number")
);
--> statement-breakpoint
CREATE TABLE "search_index_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"indexed_at" timestamp,
	"index_version" text,
	"status" "index_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"events" jsonb NOT NULL,
	"secret" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"timeout_ms" integer DEFAULT 30000 NOT NULL,
	"retry_config" jsonb DEFAULT '{"maxAttempts":5,"backoffMs":[1000,5000,30000,300000,1800000]}'::jsonb NOT NULL,
	"headers" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"type" "wallet_transaction_type" NOT NULL,
	"amount" real DEFAULT 0 NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"balance_after" real NOT NULL,
	"points_after" integer NOT NULL,
	"order_id" uuid,
	"refund_id" uuid,
	"description" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_delivery_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"event_id" text NOT NULL,
	"status" "webhook_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"response_status" integer,
	"response_body" text,
	"request_body" jsonb NOT NULL,
	"error_message" text,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incoming_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"provider" "incoming_webhook_provider" NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"signature" text,
	"headers" jsonb,
	"status" "incoming_webhook_status" DEFAULT 'pending' NOT NULL,
	"processed_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_groups" ADD COLUMN "tax_display_type" "tax_display_type" DEFAULT 'EXCLUSIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD COLUMN "currency" text;--> statement-breakpoint
ALTER TABLE "price_lists" ADD COLUMN "currency" text;--> statement-breakpoint
ALTER TABLE "abandoned_cart_recoveries" ADD CONSTRAINT "abandoned_cart_recoveries_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abandoned_cart_recoveries" ADD CONSTRAINT "abandoned_cart_recoveries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_activities" ADD CONSTRAINT "cart_activities_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_activities" ADD CONSTRAINT "cart_activities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_wallets" ADD CONSTRAINT "customer_wallets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_rules" ADD CONSTRAINT "loyalty_rules_customer_group_id_customer_groups_id_fk" FOREIGN KEY ("customer_group_id") REFERENCES "public"."customer_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_reconciliation" ADD CONSTRAINT "refund_reconciliation_refund_id_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refunds"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_request_id_return_requests_id_fk" FOREIGN KEY ("return_request_id") REFERENCES "public"."return_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_return_address_id_addresses_id_fk" FOREIGN KEY ("return_address_id") REFERENCES "public"."addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_refund_id_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refunds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_delivery_logs" ADD CONSTRAINT "webhook_delivery_logs_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incoming_webhooks" ADD CONSTRAINT "incoming_webhooks_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "abandoned_cart_recoveries_cart_id_idx" ON "abandoned_cart_recoveries" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "abandoned_cart_recoveries_customer_id_idx" ON "abandoned_cart_recoveries" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "abandoned_cart_recoveries_recovery_status_idx" ON "abandoned_cart_recoveries" USING btree ("recovery_status");--> statement-breakpoint
CREATE INDEX "abandoned_cart_recoveries_detected_at_idx" ON "abandoned_cart_recoveries" USING btree ("detected_at");--> statement-breakpoint
CREATE INDEX "abandoned_cart_recoveries_next_attempt_at_idx" ON "abandoned_cart_recoveries" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "cart_activities_cart_id_idx" ON "cart_activities" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "cart_activities_customer_id_idx" ON "cart_activities" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "cart_activities_session_id_idx" ON "cart_activities" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "cart_activities_created_at_idx" ON "cart_activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cart_activities_activity_type_idx" ON "cart_activities" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "customer_sessions_session_id_idx" ON "customer_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "customer_sessions_customer_id_idx" ON "customer_sessions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_sessions_cart_id_idx" ON "customer_sessions" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "customer_sessions_last_seen_at_idx" ON "customer_sessions" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "customer_sessions_is_active_idx" ON "customer_sessions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "customer_wallets_customer_id_idx" ON "customer_wallets" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "loyalty_rules_type_idx" ON "loyalty_rules" USING btree ("type");--> statement-breakpoint
CREATE INDEX "loyalty_rules_is_active_idx" ON "loyalty_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "loyalty_rules_customer_group_id_idx" ON "loyalty_rules" USING btree ("customer_group_id");--> statement-breakpoint
CREATE INDEX "loyalty_rules_valid_from_idx" ON "loyalty_rules" USING btree ("valid_from");--> statement-breakpoint
CREATE INDEX "loyalty_rules_valid_until_idx" ON "loyalty_rules" USING btree ("valid_until");--> statement-breakpoint
CREATE INDEX "refund_reconciliation_refund_id_idx" ON "refund_reconciliation" USING btree ("refund_id");--> statement-breakpoint
CREATE INDEX "refund_reconciliation_provider_refund_id_idx" ON "refund_reconciliation" USING btree ("provider_refund_id");--> statement-breakpoint
CREATE INDEX "refund_reconciliation_gateway_idx" ON "refund_reconciliation" USING btree ("gateway");--> statement-breakpoint
CREATE INDEX "refund_reconciliation_status_idx" ON "refund_reconciliation" USING btree ("status");--> statement-breakpoint
CREATE INDEX "return_eligibility_rules_enabled_idx" ON "return_eligibility_rules" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "return_eligibility_rules_priority_idx" ON "return_eligibility_rules" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "return_items_return_request_id_idx" ON "return_items" USING btree ("return_request_id");--> statement-breakpoint
CREATE INDEX "return_items_order_item_id_idx" ON "return_items" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "return_items_status_idx" ON "return_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "return_requests_order_id_idx" ON "return_requests" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "return_requests_customer_id_idx" ON "return_requests" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "return_requests_rma_number_idx" ON "return_requests" USING btree ("rma_number");--> statement-breakpoint
CREATE INDEX "return_requests_status_idx" ON "return_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "return_requests_requested_at_idx" ON "return_requests" USING btree ("requested_at");--> statement-breakpoint
CREATE INDEX "search_index_status_entity_type_entity_id_idx" ON "search_index_status" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "search_index_status_status_idx" ON "search_index_status" USING btree ("status");--> statement-breakpoint
CREATE INDEX "search_index_status_indexed_at_idx" ON "search_index_status" USING btree ("indexed_at");--> statement-breakpoint
CREATE INDEX "idx_webhooks_storeId" ON "webhooks" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_webhooks_isActive" ON "webhooks" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_webhooks_events" ON "webhooks" USING gin ("events");--> statement-breakpoint
CREATE INDEX "wallet_transactions_customer_id_idx" ON "wallet_transactions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "wallet_transactions_order_id_idx" ON "wallet_transactions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "wallet_transactions_refund_id_idx" ON "wallet_transactions" USING btree ("refund_id");--> statement-breakpoint
CREATE INDEX "wallet_transactions_type_idx" ON "wallet_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "wallet_transactions_created_at_idx" ON "wallet_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "wallet_transactions_customer_type_idx" ON "wallet_transactions" USING btree ("customer_id","type");--> statement-breakpoint
CREATE INDEX "idx_webhook_delivery_logs_webhookId" ON "webhook_delivery_logs" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_delivery_logs_status" ON "webhook_delivery_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_webhook_delivery_logs_createdAt" ON "webhook_delivery_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_delivery_logs_eventId" ON "webhook_delivery_logs" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_delivery_logs_eventType" ON "webhook_delivery_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_incoming_webhooks_storeId" ON "incoming_webhooks" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_incoming_webhooks_provider" ON "incoming_webhooks" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_incoming_webhooks_status" ON "incoming_webhooks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_incoming_webhooks_createdAt" ON "incoming_webhooks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_incoming_webhooks_eventType" ON "incoming_webhooks" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "price_list_items_currency_idx" ON "price_list_items" USING btree ("currency");--> statement-breakpoint
CREATE INDEX "price_lists_currency_idx" ON "price_lists" USING btree ("currency");