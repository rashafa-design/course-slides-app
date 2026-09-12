import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./sign-out-button";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">You&apos;re signed in</h1>
      <p className="text-gray-600">{user.email}</p>
      <p className="text-sm text-gray-400">
        This is a placeholder — uploads and your slide decks will show up here in a later phase.
      </p>
      <SignOutButton />
    </main>
  );
}
