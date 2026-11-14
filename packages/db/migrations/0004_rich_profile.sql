ALTER TABLE "users" ADD COLUMN "university" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "degree" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "graduation_year" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cgpa" numeric(4, 2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "headline" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "linkedin_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "github_login" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "github_stats" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "projects" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "certifications" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "experience" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"content" bytea,
	"status" text DEFAULT 'queued' NOT NULL,
	"result" jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"parsed_at" timestamp
);--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_status_created_idx" ON "documents" USING btree ("status","created_at");
