-- Optional thank-you tip link on profiles. See DATA.md.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tip_url text;
