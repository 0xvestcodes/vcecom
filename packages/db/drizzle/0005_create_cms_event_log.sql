-- Create CMS event log table for event replayability and idempotency
CREATE TABLE IF NOT EXISTS "cms_event_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" text NOT NULL UNIQUE,
  "event_type" text NOT NULL,
  "entry_id" text NOT NULL,
  "content_type_id" text NOT NULL,
  "snapshot_id" text,
  "snapshot_number" text,
  "snapshot_type" text,
  "sequence_number" text NOT NULL,
  "payload" jsonb NOT NULL,
  "timestamp" timestamp DEFAULT now() NOT NULL,
  "user_id" text,
  "processed" text DEFAULT 'false',
  "processed_at" timestamp
);

CREATE INDEX "cms_event_log_entry_id_idx" ON "cms_event_log" USING btree ("entry_id");
CREATE INDEX "cms_event_log_event_id_idx" ON "cms_event_log" USING btree ("event_id");
CREATE INDEX "cms_event_log_sequence_idx" ON "cms_event_log" USING btree ("entry_id", "sequence_number");
CREATE INDEX "cms_event_log_processed_idx" ON "cms_event_log" USING btree ("processed");
