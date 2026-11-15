-- Kits: organiser need lists (fest, club, business). See DATA.md.
CREATE TABLE IF NOT EXISTS public.kits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES public.users(id),
    name text NOT NULL,
    kind text NOT NULL,
    description text,
    event_date timestamp,
    campus_domain text,
    campus_only boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'open',
    hidden_at timestamp,
    created_at timestamp NOT NULL DEFAULT now()
);
ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kits FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kits TO attest_app;
ALTER TABLE public.gigs ADD COLUMN IF NOT EXISTS kit_id uuid REFERENCES public.kits(id);
CREATE INDEX IF NOT EXISTS gigs_kit_idx ON public.gigs (kit_id);
