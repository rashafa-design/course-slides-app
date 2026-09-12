-- Reversal of the earlier "reuse only" decision: slides with no source
-- diagram now get a Gemini-generated illustration instead, up to whatever
-- the free tier allows per run. This column holds the friendly heads-up
-- shown on the dashboard when that limit gets hit partway through.
-- Run in Supabase's SQL Editor. No new grants needed.

alter table public.decks
  add column if not exists image_generation_note text;
