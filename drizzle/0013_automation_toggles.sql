ALTER TABLE "tpa_settings" ADD COLUMN "enable_sheets_sync" boolean DEFAULT false NOT NULL;
ALTER TABLE "tpa_settings" ADD COLUMN "enable_kit_reminders" boolean DEFAULT true NOT NULL;
ALTER TABLE "tpa_settings" ADD COLUMN "enable_collector_confirm_reminders" boolean DEFAULT true NOT NULL;
ALTER TABLE "tpa_settings" ADD COLUMN "enable_results_pending_daily" boolean DEFAULT true NOT NULL;
ALTER TABLE "tpa_settings" ADD COLUMN "enable_order_completion_email" boolean DEFAULT true NOT NULL;
ALTER TABLE "tpa_settings" ADD COLUMN "enable_event_completion_email" boolean DEFAULT true NOT NULL;
ALTER TABLE "tpa_settings" ADD COLUMN "enable_lead_stage_emails" boolean DEFAULT false NOT NULL;
ALTER TABLE "tpa_settings" ADD COLUMN "enable_lead_follow_up_reminders" boolean DEFAULT true NOT NULL;
