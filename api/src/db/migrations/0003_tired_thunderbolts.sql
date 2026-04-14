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
ALTER TABLE "moral_profiles" ADD CONSTRAINT "moral_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_moral_profiles_user" ON "moral_profiles" USING btree ("user_id");