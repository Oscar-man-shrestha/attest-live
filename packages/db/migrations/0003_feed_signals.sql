ALTER TABLE "users" ADD COLUMN "profile_embedding" vector(384);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"idea_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"dwell_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interactions_user_created_idx" ON "interactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interactions_idea_idx" ON "interactions" USING btree ("idea_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ideas_embedding_hnsw_idx" ON "ideas" USING hnsw ("embedding" vector_cosine_ops);
