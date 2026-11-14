-- Marketplace Phase 1: open academic sign-up, handles, deal types, engagements,
-- milestones, off-platform payment confirmations, reviews, scoped threads,
-- integrity flags and platform suspension. Attest never holds money.

ALTER TABLE users ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_institution boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS adult_confirmed_at timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_appeal text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS appealed_at timestamp;

CREATE TABLE IF NOT EXISTS academic_verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    email_domain text NOT NULL,
    method text NOT NULL,
    verified_at timestamp NOT NULL DEFAULT now(),
    expires_at timestamp NOT NULL,
    CONSTRAINT academic_verifications_user_domain_unique UNIQUE (user_id, email_domain)
);

ALTER TABLE ideas ADD COLUMN IF NOT EXISTS deal_type text NOT NULL DEFAULT 'credit_only';
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS budget_minor integer;
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS licence text;
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS not_academic_attested_at timestamp;
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS integrity_checked_at timestamp;

ALTER TABLE problems ADD COLUMN IF NOT EXISTS not_academic_attested_at timestamp;
ALTER TABLE problems ADD COLUMN IF NOT EXISTS integrity_checked_at timestamp;

CREATE TABLE IF NOT EXISTS engagements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_id uuid NOT NULL REFERENCES ideas(id),
    requester_id uuid NOT NULL REFERENCES users(id),
    builder_id uuid NOT NULL REFERENCES users(id),
    deal_type text NOT NULL,
    currency text,
    total_amount_minor integer NOT NULL DEFAULT 0,
    licence text,
    ip_terms text NOT NULL,
    nda boolean NOT NULL DEFAULT false,
    not_academic_attested_at timestamp NOT NULL,
    status text NOT NULL DEFAULT 'proposed',
    builder_accepted_at timestamp,
    completed_at timestamp,
    cancelled_at timestamp,
    cancel_reason text,
    created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS engagements_builder_status_idx ON engagements (builder_id, status);
CREATE INDEX IF NOT EXISTS engagements_requester_status_idx ON engagements (requester_id, status);

CREATE TABLE IF NOT EXISTS milestones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id uuid NOT NULL REFERENCES engagements(id),
    position integer NOT NULL,
    title text NOT NULL,
    amount_minor integer NOT NULL DEFAULT 0,
    due_at timestamp,
    status text NOT NULL DEFAULT 'open',
    deliverable_links jsonb NOT NULL DEFAULT '[]'::jsonb,
    note text,
    submitted_at timestamp,
    acceptance_deadline timestamp,
    accepted_at timestamp,
    disputed_at timestamp,
    dispute_reason text,
    created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS milestones_engagement_idx ON milestones (engagement_id, position);
CREATE INDEX IF NOT EXISTS milestones_deadline_idx ON milestones (status, acceptance_deadline);

CREATE TABLE IF NOT EXISTS payment_confirmations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id uuid NOT NULL UNIQUE REFERENCES milestones(id),
    method text NOT NULL,
    external_reference text,
    payer_confirmed_at timestamp,
    payee_confirmed_at timestamp,
    created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id uuid NOT NULL REFERENCES engagements(id),
    reviewer_id uuid NOT NULL REFERENCES users(id),
    reviewee_id uuid NOT NULL REFERENCES users(id),
    on_time integer NOT NULL,
    communication integer NOT NULL,
    quality integer NOT NULL,
    would_work_again boolean NOT NULL,
    note text,
    created_at timestamp NOT NULL DEFAULT now(),
    CONSTRAINT reviews_engagement_reviewer_unique UNIQUE (engagement_id, reviewer_id)
);
CREATE INDEX IF NOT EXISTS reviews_reviewee_idx ON reviews (reviewee_id);

CREATE TABLE IF NOT EXISTS engagement_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id uuid NOT NULL REFERENCES engagements(id),
    user_id uuid NOT NULL REFERENCES users(id),
    body text NOT NULL,
    flag text,
    created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS engagement_messages_thread_idx ON engagement_messages (engagement_id, created_at);

CREATE TABLE IF NOT EXISTS integrity_flags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type text NOT NULL,
    target_id uuid NOT NULL,
    source text NOT NULL,
    label text NOT NULL,
    score numeric(5,4),
    matched text,
    status text NOT NULL DEFAULT 'pending',
    reviewer_id uuid REFERENCES users(id),
    reviewed_at timestamp,
    created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS integrity_flags_status_idx ON integrity_flags (status, created_at);

-- Same lockdown as existing tables: RLS on, no Data API access, app role only.
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['academic_verifications','engagements','milestones','payment_confirmations','reviews','engagement_messages','integrity_flags']
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated', t);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO attest_app', t);
    END LOOP;
END $$;
