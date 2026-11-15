-- "I'd use this" demand signal: allow reactions.target_type = 'want'. See DATA.md.
ALTER TABLE public.reactions DROP CONSTRAINT IF EXISTS reactions_target_type_check;
ALTER TABLE public.reactions ADD CONSTRAINT reactions_target_type_check CHECK (target_type IN ('idea', 'comment', 'want'));
