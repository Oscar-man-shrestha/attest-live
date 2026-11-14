ALTER TABLE "users" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "branch" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "semester" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "campus_skills" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "interests" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_week_line" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "hours_per_week" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "available_days" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "github_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "site_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE "sprints" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ends_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "problems" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "author_id" uuid NOT NULL REFERENCES "users"("id"),
  "sprint_id" uuid REFERENCES "sprints"("id"),
  "title" text NOT NULL,
  "what_happens" text NOT NULL,
  "who_feels" text NOT NULL,
  "fix_would_change" text NOT NULL,
  "source" text NOT NULL,
  "author_name" text,
  "author_branch" text,
  "author_semester" integer,
  "hide_name" boolean DEFAULT false NOT NULL,
  "fresh_line" text,
  "hidden_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "pitch" text;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "audience" text;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "gap" text;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "ships" text;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "stage" text DEFAULT 'idea' NOT NULL;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "team_status" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "help_needed" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "is_small" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "hour_cap" integer;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "compensation_sentence" text;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "hide_name" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "author_name" text;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "author_branch" text;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "author_semester" integer;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "problem_id" uuid REFERENCES "problems"("id");--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "duplicate_of_id" uuid;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "sprint_id" uuid REFERENCES "sprints"("id");--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "hidden_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "ideas_problem_id_unique" ON "ideas" ("problem_id") WHERE "problem_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE "approaches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "idea_id" uuid REFERENCES "ideas"("id"),
  "problem_id" uuid REFERENCES "problems"("id"),
  "body" text NOT NULL,
  "contact_email" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "approaches_one_target" CHECK ("idea_id" IS NOT NULL OR "problem_id" IS NOT NULL)
);--> statement-breakpoint
CREATE UNIQUE INDEX "approaches_idea_id_unique" ON "approaches" ("idea_id") WHERE "idea_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "approaches_problem_id_unique" ON "approaches" ("problem_id") WHERE "problem_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE "revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "target_type" text NOT NULL,
  "target_id" uuid NOT NULL,
  "snapshot" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "offers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "builder_id" uuid NOT NULL REFERENCES "users"("id"),
  "sprint_id" uuid REFERENCES "sprints"("id"),
  "idea_id" uuid REFERENCES "ideas"("id"),
  "problem_id" uuid REFERENCES "problems"("id"),
  "body" text NOT NULL,
  "hours_per_week" integer NOT NULL,
  "available_days" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "links" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "proposal" jsonb,
  "status" text DEFAULT 'new' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "offers_one_target" CHECK (("idea_id" IS NOT NULL) <> ("problem_id" IS NOT NULL))
);--> statement-breakpoint
CREATE TABLE "tryouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "offer_id" uuid NOT NULL UNIQUE REFERENCES "offers"("id"),
  "brief" text NOT NULL,
  "hour_cap" integer NOT NULL,
  "outcome" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "team_members" (
  "idea_id" uuid NOT NULL REFERENCES "ideas"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "joined_at" timestamp DEFAULT now() NOT NULL,
  "left_at" timestamp,
  "exit_reason" text,
  PRIMARY KEY ("idea_id", "user_id")
);--> statement-breakpoint
CREATE TABLE "tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "idea_id" uuid NOT NULL REFERENCES "ideas"("id"),
  "title" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "links" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "role" text,
  "status" text DEFAULT 'todo' NOT NULL,
  "assignee_id" uuid REFERENCES "users"("id"),
  "receipt_status" text,
  "frozen_at" timestamp,
  "signed_at" timestamp,
  "removed_at" timestamp,
  "witness_id" uuid REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "check_ins" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "idea_id" uuid NOT NULL REFERENCES "ideas"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "done" text NOT NULL,
  "stuck" text NOT NULL,
  "next" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "check_ins_idea_user" UNIQUE ("idea_id", "user_id")
);--> statement-breakpoint
CREATE TABLE "proof_pages" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id"),
  "published" boolean DEFAULT false NOT NULL
);--> statement-breakpoint
CREATE TABLE "sprint_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "idea_id" uuid NOT NULL REFERENCES "ideas"("id"),
  "email" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "saves" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "target_type" text NOT NULL,
  "target_id" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "saves_user_target" UNIQUE ("user_id", "target_type", "target_id")
);--> statement-breakpoint
CREATE TABLE "notices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "body" text NOT NULL,
  "target_id" uuid,
  "read_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" text NOT NULL,
  "actor_id" uuid REFERENCES "users"("id"),
  "target_type" text,
  "target_id" uuid,
  "payload" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);