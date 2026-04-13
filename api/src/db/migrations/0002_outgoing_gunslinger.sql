CREATE TABLE "experiment_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"variant" varchar(50) NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"variant" varchar(50) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"event_value" integer DEFAULT 1 NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"variants" text NOT NULL,
	"traffic_percent" integer DEFAULT 100 NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"started_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "experiments_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "experiment_assignments" ADD CONSTRAINT "experiment_assignments_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_assignments" ADD CONSTRAINT "experiment_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_events" ADD CONSTRAINT "experiment_events_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_events" ADD CONSTRAINT "experiment_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_exp_assignments_unique" ON "experiment_assignments" USING btree ("experiment_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_exp_assignments_user" ON "experiment_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_exp_assignments_experiment" ON "experiment_assignments" USING btree ("experiment_id");--> statement-breakpoint
CREATE INDEX "idx_exp_events_experiment" ON "experiment_events" USING btree ("experiment_id");--> statement-breakpoint
CREATE INDEX "idx_exp_events_user" ON "experiment_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_exp_events_type" ON "experiment_events" USING btree ("experiment_id","event_type");--> statement-breakpoint
CREATE INDEX "idx_experiments_status" ON "experiments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_experiments_key" ON "experiments" USING btree ("key");