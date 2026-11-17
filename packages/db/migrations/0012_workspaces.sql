-- SaaS: workspaces (organiser teams), members, subscriptions. See DATA.md.
CREATE TABLE IF NOT EXISTS public.workspaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    kind text NOT NULL,
    owner_id uuid NOT NULL REFERENCES public.users(id),
    created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.workspace_members (
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
    user_id uuid NOT NULL REFERENCES public.users(id),
    role text NOT NULL DEFAULT 'member',
    joined_at timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON public.workspace_members (user_id);
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
    plan text NOT NULL,
    status text NOT NULL DEFAULT 'requested',
    amount_minor integer,
    currency text,
    period_end timestamp,
    note text,
    requested_by uuid NOT NULL REFERENCES public.users(id),
    approved_by uuid REFERENCES public.users(id),
    created_at timestamp NOT NULL DEFAULT now(),
    approved_at timestamp
);
CREATE INDEX IF NOT EXISTS subscriptions_workspace_idx ON public.subscriptions (workspace_id, status);
ALTER TABLE public.kits ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['workspaces','workspace_members','subscriptions']
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO attest_app', t);
    END LOOP;
END $$;
