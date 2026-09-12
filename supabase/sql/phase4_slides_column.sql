-- Phase 4: room to store the AI's structured slide output.
-- Run this once in Supabase: dashboard -> SQL Editor -> New query -> paste -> Run.
-- No new grants needed - public.decks already has them.

alter table public.decks
  add column if not exists slides_json jsonb;
