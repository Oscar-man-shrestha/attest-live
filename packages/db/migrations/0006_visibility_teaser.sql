-- Visibility + teaser blurb for sprint ideas; richer offers; profile cover
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'standard';
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS blurb text;

ALTER TABLE offers ADD COLUMN IF NOT EXISTS skills jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS phases jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS currently_working_on text;
