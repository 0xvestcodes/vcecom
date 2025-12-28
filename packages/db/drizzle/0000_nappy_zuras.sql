CREATE TYPE "public"."address_type" AS ENUM('shipping', 'billing', 'both');--> statement-breakpoint
CREATE TYPE "public"."cart_item_state" AS ENUM('fresh', 'stale', 'reacquired', 'committed');--> statement-breakpoint
CREATE TYPE "public"."collection_match_type" AS ENUM('all', 'any');--> statement-breakpoint
CREATE TYPE "public"."collection_type" AS ENUM('manual', 'automatic');--> statement-breakpoint
CREATE TYPE "public"."discount_audit_event_type" AS ENUM('DISCOUNT_ENGINE_RUN', 'DISCOUNT_SNAPSHOT_CREATED', 'DISCOUNT_SNAPSHOT_USED', 'DISCOUNT_RULE_CHANGE', 'DISCOUNT_ELIGIBILITY_CHANGE', 'ORDER_DISCOUNT_FINALIZED', 'REFUND_DISCOUNT_APPLIED', 'DRIFT_DETECTED');--> statement-breakpoint
CREATE TYPE "public"."discount_audit_severity" AS ENUM('INFO', 'WARNING', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."discount_application_type" AS ENUM('AUTOMATIC', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."discount_applies_to" AS ENUM('SUBTOTAL', 'TOTAL');--> statement-breakpoint
CREATE TYPE "public"."discount_scope" AS ENUM('ORDER', 'PRODUCT');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('FIXED_AMOUNT', 'PERCENTAGE', 'BUY_X_GET_Y', 'TIERED', 'CART_LEVEL');--> statement-breakpoint
CREATE TYPE "public"."discount_value_type" AS ENUM('AMOUNT', 'PERCENTAGE');--> statement-breakpoint
CREATE TYPE "public"."inventory_adjustment_reason" AS ENUM('received', 'correction', 'damaged', 'lost', 'returned', 'giveaway', 'manual');--> statement-breakpoint
CREATE TYPE "public"."inventory_adjustment_type" AS ENUM('increase', 'decrease', 'set');--> statement-breakpoint
CREATE TYPE "public"."media_audit_action" AS ENUM('delete', 'reorder_fix', 'orphan_cleanup', 'inherit_fix', 's3_cleanup', 'order_reset');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('ORDER', 'INVENTORY', 'REVIEW', 'SHIPPING', 'PAYMENT', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_fee_audit_event_type" AS ENUM('PAYMENT_FEE_APPLIED', 'PAYMENT_FEE_OVERRIDDEN', 'PAYMENT_METHOD_RESTRICTED', 'PAYMENT_METHOD_NOT_AVAILABLE', 'PAYMENT_FEE_CONFIGURATION_CHANGED');--> statement-breakpoint
CREATE TYPE "public"."payment_fee_audit_severity" AS ENUM('INFO', 'WARNING', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."charge_type" AS ENUM('FLAT', 'PERCENTAGE', 'MIXED');--> statement-breakpoint
CREATE TYPE "public"."payment_method_charge" AS ENUM('COD', 'RAZORPAY_UPI', 'RAZORPAY_CARD', 'STRIPE_CARD', 'WALLET', 'NETBANKING', 'BNPL');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('razorpay', 'cod', 'upi', 'card', 'netbanking', 'wallet', 'razorpay_upi', 'razorpay_card', 'stripe_card', 'bnpl');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'processing', 'captured', 'failed', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."shipping_zone" AS ENUM('metro', 'zone_a', 'zone_b', 'zone_c', 'zone_d', 'zone_e');--> statement-breakpoint
CREATE TYPE "public"."price_list_override_type" AS ENUM('FIXED', 'PERCENTAGE');--> statement-breakpoint
CREATE TYPE "public"."price_list_type" AS ENUM('B2C', 'B2B', 'WHOLESALE', 'RETAIL', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."pricing_audit_event_type" AS ENUM('PRICING_ENGINE_RUN', 'PRICING_SNAPSHOT_CREATED', 'PRICING_SNAPSHOT_USED', 'PRICE_LIST_CHANGE', 'PRICING_DRIFT_DETECTED');--> statement-breakpoint
CREATE TYPE "public"."pricing_audit_severity" AS ENUM('INFO', 'WARNING', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."pricing_type" AS ENUM('inclusive', 'exclusive');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('pending', 'label_generated', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."shipping_payment_method" AS ENUM('prepaid', 'cod', 'both');--> statement-breakpoint
CREATE TYPE "public"."shipping_rule_type" AS ENUM('weight_based', 'distance_based', 'zone_based', 'state_based');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'customer', 'support', 'reviewer', 'marketing');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"type" "address_type" DEFAULT 'shipping' NOT NULL,
	"street" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"pincode" text NOT NULL,
	"district" text,
	"country" text DEFAULT 'India' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_2fa" (
	"admin_id" uuid PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text[],
	"enabled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"action" text NOT NULL,
	"entity_id" text,
	"metadata" jsonb,
	"diff" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"permissions" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"device_id" text NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"last_used_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_sessions_refresh_token_hash_unique" UNIQUE("refresh_token_hash")
);
--> statement-breakpoint
CREATE TABLE "bundle_set_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bundle_set_items_set_id_variant_id_unique" UNIQUE("set_id","variant_id")
);
--> statement-breakpoint
CREATE TABLE "bundle_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"min_quantity" integer DEFAULT 0 NOT NULL,
	"max_quantity" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"allow_mix_and_match" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"product_variant_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"price" real NOT NULL,
	"metadata" jsonb,
	"state" "cart_item_state" DEFAULT 'fresh' NOT NULL,
	"stale_marked_at" timestamp,
	"reacquired_at" timestamp,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"session_id" text,
	"subtotal" real DEFAULT 0 NOT NULL,
	"gst_amount" real DEFAULT 0 NOT NULL,
	"discount_code" text,
	"discount_amount" real DEFAULT 0 NOT NULL,
	"total" real DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "carts_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"parent_id" uuid,
	"description" text,
	"image_url" text,
	"position" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"image_url" text,
	"type" "collection_type" DEFAULT 'manual' NOT NULL,
	"rules" jsonb,
	"match_type" "collection_match_type" DEFAULT 'all',
	"position" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collections_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "customer_group_price_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_group_id" uuid NOT NULL,
	"price_list_id" uuid NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_groups_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"name" text NOT NULL,
	"gstin" text,
	"is_guest" boolean DEFAULT true NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"customer_group_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customers_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "customers_email_unique" UNIQUE("email"),
	CONSTRAINT "customers_phone_unique" UNIQUE("phone"),
	CONSTRAINT "customers_gstin_unique" UNIQUE("gstin")
);
--> statement-breakpoint
CREATE TABLE "discount_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"event" "discount_audit_event_type" NOT NULL,
	"severity" "discount_audit_severity" DEFAULT 'INFO' NOT NULL,
	"cart_id" uuid,
	"checkout_id" uuid,
	"order_id" uuid,
	"payment_intent_id" text,
	"snapshot_version" text,
	"rule_hash" text,
	"engine_version" text,
	"computed_subtotal" real,
	"computed_total" real,
	"snapshot_total" real,
	"payment_amount" real,
	"applied_discount_ids" jsonb,
	"drift_details" jsonb,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "discount_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discount_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discount_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_exclusions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discount_id" uuid NOT NULL,
	"excluded_discount_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_get_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discount_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_get_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discount_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_get_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discount_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_get_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discount_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discount_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discount_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_tiered_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discount_id" uuid NOT NULL,
	"min_quantity" integer NOT NULL,
	"value" real NOT NULL,
	"value_type" "discount_value_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discount_id" uuid NOT NULL,
	"user_id" uuid,
	"order_id" uuid,
	"used_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "discount_type" NOT NULL,
	"application_type" "discount_application_type" DEFAULT 'MANUAL' NOT NULL,
	"value_type" "discount_value_type" NOT NULL,
	"value" real NOT NULL,
	"min_order_amount" real,
	"max_discount_amount" real,
	"min_quantity" integer,
	"customer_group_ids" text,
	"scope" "discount_scope" DEFAULT 'PRODUCT' NOT NULL,
	"applies_to" "discount_applies_to" DEFAULT 'SUBTOTAL' NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"can_stack" boolean DEFAULT true NOT NULL,
	"mutually_exclusive" boolean DEFAULT false NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"usage_limit" integer,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"per_user_limit" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discounts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "inventory_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"old_quantity" integer NOT NULL,
	"new_quantity" integer NOT NULL,
	"delta" integer NOT NULL,
	"type" "inventory_adjustment_type" NOT NULL,
	"reason" "inventory_adjustment_reason" NOT NULL,
	"note" text,
	"actor_admin_id" uuid NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"global_low_stock_threshold" integer DEFAULT 5 NOT NULL,
	"per_variant_overrides" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"order_id" uuid NOT NULL,
	"pdf_path" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "media_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid,
	"variant_id" uuid,
	"image_id" uuid,
	"action" "media_audit_action" NOT NULL,
	"details" jsonb,
	"performed_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"meta" jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_variant_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"price" real NOT NULL,
	"gst_rate" real DEFAULT 0 NOT NULL,
	"gst_amount" real DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"note" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"author_id" uuid,
	"author_name" text,
	"author_email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"order_number" text NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"subtotal" real DEFAULT 0 NOT NULL,
	"gst_amount" real DEFAULT 0 NOT NULL,
	"discount_code" text,
	"discount_amount" real DEFAULT 0 NOT NULL,
	"shipping_cost" real DEFAULT 0 NOT NULL,
	"payment_fee" integer DEFAULT 0 NOT NULL,
	"payment_method" text,
	"payment_fee_breakdown" jsonb,
	"payment_fee_currency" text DEFAULT 'INR' NOT NULL,
	"total" real DEFAULT 0 NOT NULL,
	"razorpay_order_id" text,
	"shipping_provider" text,
	"shipping_address_id" uuid NOT NULL,
	"billing_address_id" uuid NOT NULL,
	"discount_snapshot" jsonb,
	"pricing_snapshot" jsonb,
	"archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp,
	"archived_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "orders_razorpay_order_id_unique" UNIQUE("razorpay_order_id")
);
--> statement-breakpoint
CREATE TABLE "payment_fee_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"event" "payment_fee_audit_event_type" NOT NULL,
	"severity" "payment_fee_audit_severity" DEFAULT 'INFO' NOT NULL,
	"order_id" uuid,
	"checkout_id" uuid,
	"payment_intent_id" text,
	"payment_method" text NOT NULL,
	"fee_amount" integer,
	"fee_breakdown" jsonb,
	"reason" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "payment_method_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"method" "payment_method_charge" NOT NULL,
	"charge_type" charge_type NOT NULL,
	"flat_amount" integer DEFAULT 0 NOT NULL,
	"percentage" real DEFAULT 0 NOT NULL,
	"mix_cap" integer,
	"mix_min" integer,
	"is_taxable" boolean DEFAULT false NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"cod_max_amount" integer,
	"cod_disallow_high_value" boolean DEFAULT false NOT NULL,
	"cod_disallow_digital" boolean DEFAULT true NOT NULL,
	"cod_disallow_preorder" boolean DEFAULT true NOT NULL,
	"cod_disallow_international" boolean DEFAULT true NOT NULL,
	"cod_restricted_states" jsonb,
	"cod_allowed_customer_groups" jsonb,
	"restricted_regions" jsonb,
	"restricted_cart_content" jsonb,
	"min_order_value" integer,
	"max_order_value" integer,
	"store_level_disabled" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"razorpay_payment_id" text,
	"razorpay_order_id" text,
	"amount" real NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"method" "payment_method" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payments_razorpay_payment_id_unique" UNIQUE("razorpay_payment_id")
);
--> statement-breakpoint
CREATE TABLE "pincodes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pincodes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"pincode" text NOT NULL,
	"office_name" text NOT NULL,
	"district" text NOT NULL,
	"state" text NOT NULL,
	"state_code" text NOT NULL,
	"region" text,
	"division" text,
	"taluk" text,
	"circle" text,
	"latitude" real,
	"longitude" real,
	"is_serviceable" boolean DEFAULT true NOT NULL,
	"cod_available" boolean DEFAULT true NOT NULL,
	"shipping_zone" "shipping_zone" DEFAULT 'zone_c' NOT NULL,
	"estimated_delivery_days" integer DEFAULT 3 NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pincodes_pincode_unique" UNIQUE("pincode")
);
--> statement-breakpoint
CREATE TABLE "price_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"price_list_id" uuid NOT NULL,
	"product_variant_id" uuid,
	"product_id" uuid,
	"category_id" uuid,
	"override_type" "price_list_override_type" NOT NULL,
	"override_value" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "price_list_type" DEFAULT 'CUSTOM' NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"event" "pricing_audit_event_type" NOT NULL,
	"severity" "pricing_audit_severity" DEFAULT 'INFO' NOT NULL,
	"variant_id" uuid,
	"order_id" uuid,
	"checkout_id" uuid,
	"price_list_id" uuid,
	"customer_group_id" uuid,
	"base_price" real,
	"effective_price" real,
	"snapshot_price" real,
	"payment_amount" real,
	"ruleset_version" text,
	"rule_hash" text,
	"engine_version" text,
	"drift_details" jsonb,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "product_associations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"associated_product_id" uuid NOT NULL,
	"frequency_count" real DEFAULT 1 NOT NULL,
	"confidence_score" real,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"url" text NOT NULL,
	"alt_text" text,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"price" real NOT NULL,
	"compare_at_price" real,
	"currency" text DEFAULT 'INR' NOT NULL,
	"sale_price" real,
	"sale_start_date" timestamp,
	"sale_end_date" timestamp,
	"inventory" integer DEFAULT 0 NOT NULL,
	"size" text,
	"color" text,
	"weight" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"price" real NOT NULL,
	"gst_rate" real DEFAULT 0 NOT NULL,
	"pricing_type" "pricing_type" DEFAULT 'exclusive' NOT NULL,
	"hsn_code" text,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"category_id" uuid,
	"is_digital" boolean DEFAULT false NOT NULL,
	"is_preorder" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"amount" real NOT NULL,
	"reason" text NOT NULL,
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"provider_refund_id" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_helpful_votes" (
	"customer_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "review_helpful_votes_customer_id_review_id_pk" PRIMARY KEY("customer_id","review_id")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"images" jsonb,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_customer_variant_unique" UNIQUE("customer_id","variant_id")
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"tracking_number" text,
	"status" "shipment_status" DEFAULT 'pending' NOT NULL,
	"label_url" text,
	"awb_number" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shipments_tracking_number_unique" UNIQUE("tracking_number"),
	CONSTRAINT "shipments_awb_number_unique" UNIQUE("awb_number")
);
--> statement-breakpoint
CREATE TABLE "shipping_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"code" text NOT NULL,
	"base_rate" real NOT NULL,
	"estimated_days" integer NOT NULL,
	"cod_available" boolean DEFAULT true NOT NULL,
	"cod_charge" real,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"min_order_value" integer,
	"max_order_value" integer,
	"restricted_zones" jsonb,
	"restricted_states" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shipping_methods_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "shipping_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "shipping_rule_type" NOT NULL,
	"zone" text,
	"state" text,
	"min_weight" integer,
	"max_weight" integer,
	"base_rate" real NOT NULL,
	"additional_rate" real,
	"cod_charge" real,
	"payment_methods" "shipping_payment_method" DEFAULT 'both' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"conditions" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_zone_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zone" text NOT NULL,
	"min_weight" integer DEFAULT 0 NOT NULL,
	"max_weight" integer,
	"base_rate" real NOT NULL,
	"additional_per_kg" real,
	"estimated_days" integer DEFAULT 3 NOT NULL,
	"cod_available" boolean DEFAULT true NOT NULL,
	"cod_charge" real,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "state_shipping_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" text NOT NULL,
	"state_code" text NOT NULL,
	"cod_available" boolean DEFAULT true NOT NULL,
	"cod_charge" real,
	"special_handling" boolean DEFAULT false NOT NULL,
	"restricted_items" text,
	"additional_days" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"primary_color" text,
	"logo_url" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stores_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name"),
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"role_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "product_variant_option_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"option_type_id" uuid,
	"name" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variant_option_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "variant_option_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "variant_option_value_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"option_value_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "variant_option_value_assignments_unique_variant_option_value" UNIQUE("variant_id","option_value_id")
);
--> statement-breakpoint
CREATE TABLE "variant_option_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_variant_option_type_id" uuid NOT NULL,
	"value" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "variant_option_values_unique_value_per_option_type" UNIQUE("product_variant_option_type_id","value")
);
--> statement-breakpoint
CREATE TABLE "variant_review_aggregate" (
	"variant_id" uuid PRIMARY KEY NOT NULL,
	"average_rating" real DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"rating_1_count" integer DEFAULT 0 NOT NULL,
	"rating_2_count" integer DEFAULT 0 NOT NULL,
	"rating_3_count" integer DEFAULT 0 NOT NULL,
	"rating_4_count" integer DEFAULT 0 NOT NULL,
	"rating_5_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_2fa" ADD CONSTRAINT "admin_2fa_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_activity_logs" ADD CONSTRAINT "admin_activity_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_set_items" ADD CONSTRAINT "bundle_set_items_set_id_bundle_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."bundle_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_set_items" ADD CONSTRAINT "bundle_set_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_sets" ADD CONSTRAINT "bundle_sets_bundle_id_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."bundles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_variant_id_product_variants_id_fk" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_group_price_lists" ADD CONSTRAINT "customer_group_price_lists_customer_group_id_customer_groups_id_fk" FOREIGN KEY ("customer_group_id") REFERENCES "public"."customer_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_group_price_lists" ADD CONSTRAINT "customer_group_price_lists_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_customer_group_id_customer_groups_id_fk" FOREIGN KEY ("customer_group_id") REFERENCES "public"."customer_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_categories" ADD CONSTRAINT "discount_categories_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_categories" ADD CONSTRAINT "discount_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_collections" ADD CONSTRAINT "discount_collections_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_collections" ADD CONSTRAINT "discount_collections_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_exclusions" ADD CONSTRAINT "discount_exclusions_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_exclusions" ADD CONSTRAINT "discount_exclusions_excluded_discount_id_discounts_id_fk" FOREIGN KEY ("excluded_discount_id") REFERENCES "public"."discounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_get_categories" ADD CONSTRAINT "discount_get_categories_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_get_categories" ADD CONSTRAINT "discount_get_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_get_collections" ADD CONSTRAINT "discount_get_collections_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_get_collections" ADD CONSTRAINT "discount_get_collections_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_get_products" ADD CONSTRAINT "discount_get_products_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_get_products" ADD CONSTRAINT "discount_get_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_get_tags" ADD CONSTRAINT "discount_get_tags_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_get_tags" ADD CONSTRAINT "discount_get_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_products" ADD CONSTRAINT "discount_products_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_products" ADD CONSTRAINT "discount_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_tags" ADD CONSTRAINT "discount_tags_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_tags" ADD CONSTRAINT "discount_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_tiered_rules" ADD CONSTRAINT "discount_tiered_rules_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_usages" ADD CONSTRAINT "discount_usages_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_actor_admin_id_users_id_fk" FOREIGN KEY ("actor_admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_settings" ADD CONSTRAINT "inventory_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_audit_logs" ADD CONSTRAINT "media_audit_logs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_audit_logs" ADD CONSTRAINT "media_audit_logs_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_audit_logs" ADD CONSTRAINT "media_audit_logs_image_id_product_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."product_images"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_variant_id_product_variants_id_fk" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_address_id_addresses_id_fk" FOREIGN KEY ("shipping_address_id") REFERENCES "public"."addresses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_billing_address_id_addresses_id_fk" FOREIGN KEY ("billing_address_id") REFERENCES "public"."addresses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_archived_by_customers_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_product_variant_id_product_variants_id_fk" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_associations" ADD CONSTRAINT "product_associations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_associations" ADD CONSTRAINT "product_associations_associated_product_id_products_id_fk" FOREIGN KEY ("associated_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_collections" ADD CONSTRAINT "product_collections_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_collections" ADD CONSTRAINT "product_collections_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_helpful_votes" ADD CONSTRAINT "review_helpful_votes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_helpful_votes" ADD CONSTRAINT "review_helpful_votes_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_admin_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."admin_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_option_types" ADD CONSTRAINT "product_variant_option_types_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_option_types" ADD CONSTRAINT "product_variant_option_types_option_type_id_variant_option_types_id_fk" FOREIGN KEY ("option_type_id") REFERENCES "public"."variant_option_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_option_value_assignments" ADD CONSTRAINT "variant_option_value_assignments_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_option_value_assignments" ADD CONSTRAINT "variant_option_value_assignments_option_value_id_variant_option_values_id_fk" FOREIGN KEY ("option_value_id") REFERENCES "public"."variant_option_values"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_option_values" ADD CONSTRAINT "variant_option_values_product_variant_option_type_id_product_variant_option_types_id_fk" FOREIGN KEY ("product_variant_option_type_id") REFERENCES "public"."product_variant_option_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_review_aggregate" ADD CONSTRAINT "variant_review_aggregate_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_customer_id_idx" ON "addresses" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "addresses_pincode_idx" ON "addresses" USING btree ("pincode");--> statement-breakpoint
CREATE INDEX "addresses_customer_default_idx" ON "addresses" USING btree ("customer_id","is_default");--> statement-breakpoint
CREATE INDEX "idx_admin_activity_logs_adminId" ON "admin_activity_logs" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "idx_admin_activity_logs_action" ON "admin_activity_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_admin_activity_logs_entityId" ON "admin_activity_logs" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_admin_activity_logs_createdAt" ON "admin_activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_admin_roles_name" ON "admin_roles" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_admin_sessions_adminId" ON "admin_sessions" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "idx_admin_sessions_deviceId" ON "admin_sessions" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "idx_admin_sessions_refreshTokenHash" ON "admin_sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "bundle_set_items_set_id_idx" ON "bundle_set_items" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "bundle_set_items_variant_id_idx" ON "bundle_set_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "bundle_sets_bundle_id_idx" ON "bundle_sets" USING btree ("bundle_id");--> statement-breakpoint
CREATE INDEX "bundle_sets_sort_order_idx" ON "bundle_sets" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "bundles_is_active_idx" ON "bundles" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "cart_items_cart_id_idx" ON "cart_items" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "cart_items_product_variant_id_idx" ON "cart_items" USING btree ("product_variant_id");--> statement-breakpoint
CREATE INDEX "cart_items_cart_product_idx" ON "cart_items" USING btree ("cart_id","product_variant_id");--> statement-breakpoint
CREATE INDEX "cart_items_state_idx" ON "cart_items" USING btree ("state");--> statement-breakpoint
CREATE INDEX "cart_items_archived_at_idx" ON "cart_items" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "carts_customer_id_idx" ON "carts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "carts_session_id_idx" ON "carts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_parent_id_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "categories_position_idx" ON "categories" USING btree ("position");--> statement-breakpoint
CREATE INDEX "collections_slug_idx" ON "collections" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "collections_type_idx" ON "collections" USING btree ("type");--> statement-breakpoint
CREATE INDEX "collections_position_idx" ON "collections" USING btree ("position");--> statement-breakpoint
CREATE INDEX "customer_group_price_lists_group_id_idx" ON "customer_group_price_lists" USING btree ("customer_group_id");--> statement-breakpoint
CREATE INDEX "customer_group_price_lists_price_list_id_idx" ON "customer_group_price_lists" USING btree ("price_list_id");--> statement-breakpoint
CREATE INDEX "customer_group_price_lists_unique_idx" ON "customer_group_price_lists" USING btree ("customer_group_id","price_list_id");--> statement-breakpoint
CREATE INDEX "customer_groups_name_idx" ON "customer_groups" USING btree ("name");--> statement-breakpoint
CREATE INDEX "customer_groups_active_idx" ON "customer_groups" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "customers_email_idx" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "customers_user_id_idx" ON "customers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "customers_gstin_idx" ON "customers" USING btree ("gstin");--> statement-breakpoint
CREATE INDEX "customers_customer_group_id_idx" ON "customers" USING btree ("customer_group_id");--> statement-breakpoint
CREATE INDEX "discount_audit_logs_timestamp_idx" ON "discount_audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "discount_audit_logs_event_idx" ON "discount_audit_logs" USING btree ("event");--> statement-breakpoint
CREATE INDEX "discount_audit_logs_severity_idx" ON "discount_audit_logs" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "discount_audit_logs_cart_id_idx" ON "discount_audit_logs" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "discount_audit_logs_checkout_id_idx" ON "discount_audit_logs" USING btree ("checkout_id");--> statement-breakpoint
CREATE INDEX "discount_audit_logs_order_id_idx" ON "discount_audit_logs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "discount_audit_logs_payment_intent_id_idx" ON "discount_audit_logs" USING btree ("payment_intent_id");--> statement-breakpoint
CREATE INDEX "discount_audit_logs_rule_hash_idx" ON "discount_audit_logs" USING btree ("rule_hash");--> statement-breakpoint
CREATE INDEX "discount_categories_discount_id_idx" ON "discount_categories" USING btree ("discount_id");--> statement-breakpoint
CREATE INDEX "discount_categories_category_id_idx" ON "discount_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "discount_categories_unique_idx" ON "discount_categories" USING btree ("discount_id","category_id");--> statement-breakpoint
CREATE INDEX "discount_collections_discount_id_idx" ON "discount_collections" USING btree ("discount_id");--> statement-breakpoint
CREATE INDEX "discount_collections_collection_id_idx" ON "discount_collections" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "discount_collections_unique_idx" ON "discount_collections" USING btree ("discount_id","collection_id");--> statement-breakpoint
CREATE INDEX "discount_exclusions_discount_id_idx" ON "discount_exclusions" USING btree ("discount_id");--> statement-breakpoint
CREATE INDEX "discount_exclusions_excluded_discount_id_idx" ON "discount_exclusions" USING btree ("excluded_discount_id");--> statement-breakpoint
CREATE INDEX "discount_exclusions_unique_idx" ON "discount_exclusions" USING btree ("discount_id","excluded_discount_id");--> statement-breakpoint
CREATE INDEX "discount_get_categories_discount_id_idx" ON "discount_get_categories" USING btree ("discount_id");--> statement-breakpoint
CREATE INDEX "discount_get_categories_category_id_idx" ON "discount_get_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "discount_get_collections_discount_id_idx" ON "discount_get_collections" USING btree ("discount_id");--> statement-breakpoint
CREATE INDEX "discount_get_collections_collection_id_idx" ON "discount_get_collections" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "discount_get_products_discount_id_idx" ON "discount_get_products" USING btree ("discount_id");--> statement-breakpoint
CREATE INDEX "discount_get_products_product_id_idx" ON "discount_get_products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "discount_get_tags_discount_id_idx" ON "discount_get_tags" USING btree ("discount_id");--> statement-breakpoint
CREATE INDEX "discount_get_tags_tag_id_idx" ON "discount_get_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "discount_products_discount_id_idx" ON "discount_products" USING btree ("discount_id");--> statement-breakpoint
CREATE INDEX "discount_products_product_id_idx" ON "discount_products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "discount_products_unique_idx" ON "discount_products" USING btree ("discount_id","product_id");--> statement-breakpoint
CREATE INDEX "discount_tags_discount_id_idx" ON "discount_tags" USING btree ("discount_id");--> statement-breakpoint
CREATE INDEX "discount_tags_tag_id_idx" ON "discount_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "discount_tags_unique_idx" ON "discount_tags" USING btree ("discount_id","tag_id");--> statement-breakpoint
CREATE INDEX "discount_tiered_rules_discount_id_idx" ON "discount_tiered_rules" USING btree ("discount_id");--> statement-breakpoint
CREATE INDEX "discount_tiered_rules_min_quantity_idx" ON "discount_tiered_rules" USING btree ("min_quantity");--> statement-breakpoint
CREATE INDEX "discount_tiered_rules_unique_idx" ON "discount_tiered_rules" USING btree ("discount_id","min_quantity");--> statement-breakpoint
CREATE INDEX "discount_usages_discount_id_idx" ON "discount_usages" USING btree ("discount_id");--> statement-breakpoint
CREATE INDEX "discount_usages_user_id_idx" ON "discount_usages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "discount_usages_order_id_idx" ON "discount_usages" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "discounts_code_idx" ON "discounts" USING btree ("code");--> statement-breakpoint
CREATE INDEX "discounts_type_idx" ON "discounts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "discounts_application_type_idx" ON "discounts" USING btree ("application_type");--> statement-breakpoint
CREATE INDEX "discounts_priority_idx" ON "discounts" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "discounts_is_active_idx" ON "discounts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "discounts_start_date_idx" ON "discounts" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "discounts_end_date_idx" ON "discounts" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "discounts_min_order_amount_idx" ON "discounts" USING btree ("min_order_amount");--> statement-breakpoint
CREATE INDEX "discounts_min_quantity_idx" ON "discounts" USING btree ("min_quantity");--> statement-breakpoint
CREATE INDEX "inventory_adjustments_variant_id_idx" ON "inventory_adjustments" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "inventory_adjustments_created_at_idx" ON "inventory_adjustments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "inventory_adjustments_actor_admin_id_idx" ON "inventory_adjustments" USING btree ("actor_admin_id");--> statement-breakpoint
CREATE INDEX "inventory_adjustments_type_idx" ON "inventory_adjustments" USING btree ("type");--> statement-breakpoint
CREATE INDEX "inventory_adjustments_reason_idx" ON "inventory_adjustments" USING btree ("reason");--> statement-breakpoint
CREATE INDEX "invoices_invoice_number_idx" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_order_id_idx" ON "invoices" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "media_audit_logs_product_id_idx" ON "media_audit_logs" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "media_audit_logs_variant_id_idx" ON "media_audit_logs" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "media_audit_logs_image_id_idx" ON "media_audit_logs" USING btree ("image_id");--> statement-breakpoint
CREATE INDEX "media_audit_logs_action_idx" ON "media_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "media_audit_logs_created_at_idx" ON "media_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_adminId" ON "notifications" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_read" ON "notifications" USING btree ("read");--> statement-breakpoint
CREATE INDEX "idx_notifications_createdAt" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_type" ON "notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_notifications_adminId_read" ON "notifications" USING btree ("admin_id","read");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_variant_id_idx" ON "order_items" USING btree ("product_variant_id");--> statement-breakpoint
CREATE INDEX "order_notes_order_id_idx" ON "order_notes" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_notes_is_public_idx" ON "order_notes" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "order_notes_created_at_idx" ON "order_notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_customer_id_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_order_number_idx" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_razorpay_order_id_idx" ON "orders" USING btree ("razorpay_order_id");--> statement-breakpoint
CREATE INDEX "orders_shipping_address_id_idx" ON "orders" USING btree ("shipping_address_id");--> statement-breakpoint
CREATE INDEX "orders_billing_address_id_idx" ON "orders" USING btree ("billing_address_id");--> statement-breakpoint
CREATE INDEX "orders_payment_method_idx" ON "orders" USING btree ("payment_method");--> statement-breakpoint
CREATE INDEX "orders_archived_idx" ON "orders" USING btree ("archived");--> statement-breakpoint
CREATE INDEX "payment_fee_audit_logs_timestamp_idx" ON "payment_fee_audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "payment_fee_audit_logs_event_idx" ON "payment_fee_audit_logs" USING btree ("event");--> statement-breakpoint
CREATE INDEX "payment_fee_audit_logs_severity_idx" ON "payment_fee_audit_logs" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "payment_fee_audit_logs_order_id_idx" ON "payment_fee_audit_logs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payment_fee_audit_logs_checkout_id_idx" ON "payment_fee_audit_logs" USING btree ("checkout_id");--> statement-breakpoint
CREATE INDEX "payment_fee_audit_logs_payment_intent_id_idx" ON "payment_fee_audit_logs" USING btree ("payment_intent_id");--> statement-breakpoint
CREATE INDEX "payment_fee_audit_logs_payment_method_idx" ON "payment_fee_audit_logs" USING btree ("payment_method");--> statement-breakpoint
CREATE INDEX "payment_method_charges_method_idx" ON "payment_method_charges" USING btree ("method");--> statement-breakpoint
CREATE INDEX "payment_method_charges_currency_idx" ON "payment_method_charges" USING btree ("currency");--> statement-breakpoint
CREATE INDEX "payment_method_charges_active_idx" ON "payment_method_charges" USING btree ("active");--> statement-breakpoint
CREATE INDEX "payment_method_charges_method_currency_idx" ON "payment_method_charges" USING btree ("method","currency");--> statement-breakpoint
CREATE INDEX "payments_order_id_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_razorpay_payment_id_idx" ON "payments" USING btree ("razorpay_payment_id");--> statement-breakpoint
CREATE INDEX "payments_razorpay_order_id_idx" ON "payments" USING btree ("razorpay_order_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pincodes_pincode_idx" ON "pincodes" USING btree ("pincode");--> statement-breakpoint
CREATE INDEX "pincodes_state_idx" ON "pincodes" USING btree ("state");--> statement-breakpoint
CREATE INDEX "pincodes_district_idx" ON "pincodes" USING btree ("district");--> statement-breakpoint
CREATE INDEX "pincodes_serviceable_idx" ON "pincodes" USING btree ("is_serviceable");--> statement-breakpoint
CREATE INDEX "pincodes_shipping_zone_idx" ON "pincodes" USING btree ("shipping_zone");--> statement-breakpoint
CREATE INDEX "pincodes_cod_idx" ON "pincodes" USING btree ("cod_available");--> statement-breakpoint
CREATE INDEX "price_list_items_price_list_id_idx" ON "price_list_items" USING btree ("price_list_id");--> statement-breakpoint
CREATE INDEX "price_list_items_variant_id_idx" ON "price_list_items" USING btree ("product_variant_id");--> statement-breakpoint
CREATE INDEX "price_list_items_product_id_idx" ON "price_list_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "price_list_items_category_id_idx" ON "price_list_items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "price_lists_name_idx" ON "price_lists" USING btree ("name");--> statement-breakpoint
CREATE INDEX "price_lists_type_idx" ON "price_lists" USING btree ("type");--> statement-breakpoint
CREATE INDEX "price_lists_priority_idx" ON "price_lists" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "price_lists_active_idx" ON "price_lists" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "pricing_audit_logs_timestamp_idx" ON "pricing_audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "pricing_audit_logs_event_idx" ON "pricing_audit_logs" USING btree ("event");--> statement-breakpoint
CREATE INDEX "pricing_audit_logs_severity_idx" ON "pricing_audit_logs" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "pricing_audit_logs_variant_id_idx" ON "pricing_audit_logs" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "pricing_audit_logs_order_id_idx" ON "pricing_audit_logs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "pricing_audit_logs_checkout_id_idx" ON "pricing_audit_logs" USING btree ("checkout_id");--> statement-breakpoint
CREATE INDEX "pricing_audit_logs_price_list_id_idx" ON "pricing_audit_logs" USING btree ("price_list_id");--> statement-breakpoint
CREATE INDEX "pricing_audit_logs_rule_hash_idx" ON "pricing_audit_logs" USING btree ("rule_hash");--> statement-breakpoint
CREATE INDEX "product_associations_product_id_idx" ON "product_associations" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_associations_associated_product_id_idx" ON "product_associations" USING btree ("associated_product_id");--> statement-breakpoint
CREATE INDEX "product_associations_unique_idx" ON "product_associations" USING btree ("product_id","associated_product_id");--> statement-breakpoint
CREATE INDEX "product_associations_confidence_score_idx" ON "product_associations" USING btree ("confidence_score");--> statement-breakpoint
CREATE INDEX "product_collections_product_id_idx" ON "product_collections" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_collections_collection_id_idx" ON "product_collections" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "product_collections_unique_idx" ON "product_collections" USING btree ("product_id","collection_id");--> statement-breakpoint
CREATE INDEX "product_images_product_id_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_images_variant_id_idx" ON "product_images" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "product_tags_product_id_idx" ON "product_tags" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_tags_tag_id_idx" ON "product_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "product_tags_unique_idx" ON "product_tags" USING btree ("product_id","tag_id");--> statement-breakpoint
CREATE INDEX "product_variants_product_id_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_variants_sku_idx" ON "product_variants" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "products_category_id_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "products_hsn_code_idx" ON "products" USING btree ("hsn_code");--> statement-breakpoint
CREATE INDEX "refunds_order_id_idx" ON "refunds" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "refunds_status_idx" ON "refunds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "refunds_created_at_idx" ON "refunds" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "refunds_provider_refund_id_idx" ON "refunds" USING btree ("provider_refund_id");--> statement-breakpoint
CREATE INDEX "review_helpful_votes_customer_id_idx" ON "review_helpful_votes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "review_helpful_votes_review_id_idx" ON "review_helpful_votes" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "reviews_customer_id_idx" ON "reviews" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "reviews_order_id_idx" ON "reviews" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "reviews_variant_id_idx" ON "reviews" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "reviews_status_idx" ON "reviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shipments_order_id_idx" ON "shipments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "shipments_tracking_number_idx" ON "shipments" USING btree ("tracking_number");--> statement-breakpoint
CREATE INDEX "shipments_awb_number_idx" ON "shipments" USING btree ("awb_number");--> statement-breakpoint
CREATE INDEX "shipments_status_idx" ON "shipments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shipments_provider_idx" ON "shipments" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "shipping_methods_active_idx" ON "shipping_methods" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "shipping_methods_priority_idx" ON "shipping_methods" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "shipping_rules_type_idx" ON "shipping_rules" USING btree ("type");--> statement-breakpoint
CREATE INDEX "shipping_rules_zone_idx" ON "shipping_rules" USING btree ("zone");--> statement-breakpoint
CREATE INDEX "shipping_rules_state_idx" ON "shipping_rules" USING btree ("state");--> statement-breakpoint
CREATE INDEX "shipping_rules_active_idx" ON "shipping_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "shipping_rules_priority_idx" ON "shipping_rules" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "shipping_zone_rates_zone_idx" ON "shipping_zone_rates" USING btree ("zone");--> statement-breakpoint
CREATE INDEX "shipping_zone_rates_active_idx" ON "shipping_zone_rates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "state_shipping_rules_state_idx" ON "state_shipping_rules" USING btree ("state");--> statement-breakpoint
CREATE INDEX "state_shipping_rules_state_code_idx" ON "state_shipping_rules" USING btree ("state_code");--> statement-breakpoint
CREATE INDEX "state_shipping_rules_active_idx" ON "state_shipping_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_stores_domain" ON "stores" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_stores_isDefault" ON "stores" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "tags_slug_idx" ON "tags" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tags_name_idx" ON "tags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "product_variant_option_types_product_id_idx" ON "product_variant_option_types" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_variant_option_types_option_type_id_idx" ON "product_variant_option_types" USING btree ("option_type_id");--> statement-breakpoint
CREATE INDEX "variant_option_types_name_idx" ON "variant_option_types" USING btree ("name");--> statement-breakpoint
CREATE INDEX "variant_option_value_assignments_variant_id_idx" ON "variant_option_value_assignments" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "variant_option_value_assignments_option_value_id_idx" ON "variant_option_value_assignments" USING btree ("option_value_id");--> statement-breakpoint
CREATE INDEX "variant_option_values_option_type_id_idx" ON "variant_option_values" USING btree ("product_variant_option_type_id");--> statement-breakpoint
CREATE INDEX "variant_review_aggregate_variant_id_idx" ON "variant_review_aggregate" USING btree ("variant_id");