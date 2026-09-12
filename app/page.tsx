import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-3xl font-semibold">Course slides app</h1>
      <p className="text-gray-600">
        Upload slides, a chapter, or a syllabus, and get back a simple, teach-ready deck.
      </p>
      <Link
        href="/login"
        className="rounded-md bg-gray-900 px-5 py-2.5 text-white hover:bg-gray-700"
      >
        Sign in / sign up
      </Link>
    </main>
  );
}
