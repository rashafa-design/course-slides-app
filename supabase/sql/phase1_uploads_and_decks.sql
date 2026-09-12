-- Phase 1: the filing system.
-- Run this once in Supabase: dashboard -> SQL Editor -> New query -> paste -> Run.

-- One row per file a user submits (a slide deck to rebuild, a chapter, a
-- syllabus, or a textbook excerpt).
create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('rebuild_slides', 'book_chapter', 'syllabus_excerpts')),
  file_name text not null,
  file_path text not null,
  file_type text not null,
  created_at timestamptz not null default now()
);

alter table public.uploads enable row level security;

create policy "Users manage their own uploads"
  on public.uploads
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- One row per slide deck being produced from one or more uploads.
-- Nothing generates the actual deck yet (that's a later phase) - for now
-- every deck just sits at status 'uploaded'.
create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  upload_ids uuid[] not null default '{}',
  mode text not null check (mode in ('rebuild_slides', 'book_chapter', 'syllabus_excerpts')),
  style text not null default 'plain' check (style in ('plain', 'branded')),
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'ready', 'failed')),
  deck_file_path text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.decks enable row level security;

create policy "Users manage their own decks"
  on public.decks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Private bucket holding both uploaded source files and, later, finished
-- decks. Files are stored under a path starting with the owner's user id
-- (e.g. "3f2a.../my-chapter.pdf"), which is what the policies below check.
insert into storage.buckets (id, name, public)
values ('course-files', 'course-files', false)
on conflict (id) do nothing;

create policy "Users read their own files"
  on storage.objects for select
  using (bucket_id = 'course-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users upload their own files"
  on storage.objects for insert
  with check (bucket_id = 'course-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users update their own files"
  on storage.objects for update
  using (bucket_id = 'course-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete their own files"
  on storage.objects for delete
  using (bucket_id = 'course-files' and (storage.foldername(name))[1] = auth.uid()::text);
