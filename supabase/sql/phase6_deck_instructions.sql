-- Lets the instructor steer how the AI builds the deck (slide count,
-- what to emphasize/skip, tone, etc). Run in Supabase's SQL Editor.
-- No new grants needed - public.decks already has them.

alter table public.decks
  add column if not exists instructions text;
