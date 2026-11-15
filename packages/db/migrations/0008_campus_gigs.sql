-- Campus layer (same email domain) and the gigs board. See DATA.md.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_domain text;
UPDATE public.users SET email_domain = lower(split_part(email, '@', 2)) WHERE email_domain IS NULL;
CREATE INDEX IF NOT EXISTS users_email_domain_idx ON public.users (email_domain);

ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS campus_domain text;
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS campus_only boolean NOT NULL DEFAULT false;
UPDATE public.ideas i SET campus_domain = u.email_domain FROM public.users u WHERE u.id = i.owner_id AND i.campus_domain IS NULL;
CREATE INDEX IF NOT EXISTS ideas_campus_domain_idx ON public.ideas (campus_domain);

ALTER TABLE public.problems ADD COLUMN IF NOT EXISTS campus_domain text;
UPDATE public.problems p SET campus_domain = u.email_domain FROM public.users u WHERE u.id = p.author_id AND p.campus_domain IS NULL;

CREATE TABLE IF NOT EXISTS public.gigs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id uuid NOT NULL REFERENCES public.users(id),
    kind text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    category text NOT NULL,
    deal_type text NOT NULL,
    currency text,
    price_minor integer,
    delivery_days integer,
    campus_domain text,
    campus_only boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'open',
    not_academic_attested_at timestamp NOT NULL,
    hidden_at timestamp,
    created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gigs_board_idx ON public.gigs (status, kind, created_at);

ALTER TABLE public.engagements ALTER COLUMN idea_id DROP NOT NULL;
ALTER TABLE public.engagements ADD COLUMN IF NOT EXISTS gig_id uuid REFERENCES public.gigs(id);

CREATE TABLE IF NOT EXISTS public.gig_responses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gig_id uuid NOT NULL REFERENCES public.gigs(id),
    user_id uuid NOT NULL REFERENCES public.users(id),
    note text NOT NULL,
    status text NOT NULL DEFAULT 'new',
    engagement_id uuid REFERENCES public.engagements(id),
    created_at timestamp NOT NULL DEFAULT now(),
    CONSTRAINT gig_responses_gig_user_unique UNIQUE (gig_id, user_id)
);

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['gigs','gig_responses']
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO attest_app', t);
    END LOOP;
END $$;
