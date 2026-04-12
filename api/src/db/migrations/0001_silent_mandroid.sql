ALTER TABLE "scenarios" ADD COLUMN "pack" varchar(50);--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "locale" varchar(5) DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "scenarios" DROP CONSTRAINT IF EXISTS "scenarios_publish_date_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_scenarios_publish_date_locale" ON "scenarios" USING btree ("publish_date", "locale");--> statement-breakpoint
CREATE INDEX "idx_scenarios_pack" ON "scenarios" USING btree ("pack");