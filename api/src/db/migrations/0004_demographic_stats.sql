-- Add demographic fields to users table
ALTER TABLE "users" ADD COLUMN "birth_year" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "country" varchar(2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gender" varchar(20);--> statement-breakpoint

-- Create demographic_stats table
CREATE TABLE "demographic_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"demographic_type" varchar(20) NOT NULL,
	"demographic_value" varchar(20) NOT NULL,
	"total_votes" integer DEFAULT 0 NOT NULL,
	"votes_guilty" integer DEFAULT 0 NOT NULL,
	"votes_not_guilty" integer DEFAULT 0 NOT NULL,
	"votes_complicated" integer DEFAULT 0 NOT NULL,
	"votes_both_wrong" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint
ALTER TABLE "demographic_stats" ADD CONSTRAINT "demographic_stats_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_demo_stats_unique" ON "demographic_stats" USING btree ("scenario_id","demographic_type","demographic_value");--> statement-breakpoint
CREATE INDEX "idx_demo_stats_scenario" ON "demographic_stats" USING btree ("scenario_id");--> statement-breakpoint
CREATE INDEX "idx_demo_stats_type" ON "demographic_stats" USING btree ("scenario_id","demographic_type");
