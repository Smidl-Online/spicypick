ALTER TABLE "scenarios" ADD COLUMN "pack" varchar(50);--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "locale" varchar(5) DEFAULT 'en' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_scenarios_locale" ON "scenarios" USING btree ("locale");--> statement-breakpoint
CREATE INDEX "idx_scenarios_pack" ON "scenarios" USING btree ("pack");