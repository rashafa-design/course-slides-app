# Course slides app

Turns uploaded slides, a book chapter, or a syllabus + textbook excerpts into a
simplified, teach-ready PowerPoint deck.

This is phase 0 of the build: accounts, sign-in, and an empty dashboard. No
upload or slide-generation features exist yet — those come in later phases.

## Running it on your own computer (optional, for previewing before it's live)

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.local.example` to `.env.local` and fill in your Supabase project's
   URL and anon key (Supabase dashboard → Project Settings → API).
3. Start it:
   ```
   npm run dev
   ```
4. Open http://localhost:3000

## Going live

This deploys to Vercel straight from GitHub — push to the `main` branch and
Vercel rebuilds automatically. The same three values from `.env.local` need to
be added once in the Vercel project's Settings → Environment Variables (Vercel
never reads your local `.env.local` file).

## Stack, and why

- **Next.js** — the website itself; free to host on Vercel.
- **Supabase** — the account/sign-in system, the database, and file storage,
  bundled together, free at this scale.
- **Tailwind CSS** — styling.

Full requirements and the phase-by-phase build plan live outside this repo, in
the project's roadmap.
