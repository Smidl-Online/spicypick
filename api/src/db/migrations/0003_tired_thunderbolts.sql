CREATE TABLE "moral_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"forgiving" integer DEFAULT 50 NOT NULL,
	"pragmatic" integer DEFAULT 50 NOT NULL,
	"empathetic" integer DEFAULT 50 NOT NULL,
	"confrontational" integer DEFAULT 50 NOT NULL,
	"majority_aligned" integer DEFAULT 50 NOT NULL,
	"consistent" integer DEFAULT 50 NOT NULL,
	"total_votes_analyzed" integer DEFAULT 0 NOT NULL,
	"last_calculated_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "moral_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"scenario_id" uuid NOT NULL,
	"predicted_verdict" varchar(20) NOT NULL,
	"is_correct" boolean,
	"xp_earned" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "moral_profiles" ADD CONSTRAINT "moral_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_moral_profiles_user" ON "moral_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_predictions_user_scenario" ON "predictions" USING btree ("user_id","scenario_id");--> statement-breakpoint
CREATE INDEX "idx_predictions_user" ON "predictions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_predictions_scenario" ON "predictions" USING btree ("scenario_id");