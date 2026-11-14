CREATE TABLE IF NOT EXISTS "reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reactions_user_id_target_type_target_id_unique" UNIQUE("user_id","target_type","target_id")
);--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reactions_target_idx" ON "reactions" USING btree ("target_type","target_id");--> statement-breakpoint
ALTER TABLE "idea_comments" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idea_comments_thread_idx" ON "idea_comments" USING btree ("idea_id","parent_comment_id","created_at");
