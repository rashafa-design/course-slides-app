-- Phase 2: room to store what the readers pull out of each upload.
-- Run this once in Supabase: dashboard -> SQL Editor -> New query -> paste -> Run.
-- No new grants needed - grants are table-level, and public.decks already
-- has them from the phase 1 script.

alter table public.decks
  add column if not exists extracted_text text,
  add column if not exists extracted_image_paths text[] not null default '{}';
