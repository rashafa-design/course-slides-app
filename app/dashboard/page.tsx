import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MODE_LABELS, STATUS_LABELS, type DeckRow } from "@/lib/types";
import SignOutButton from "./sign-out-button";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: decks } = await supabase
    .from("decks")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<DeckRow[]>();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your decks</h1>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
        <SignOutButton />
      </div>

      <Link
        href="/upload"
        className="rounded-md bg-gray-900 px-4 py-2 text-center text-white hover:bg-gray-700"
      >
        Upload material
      </Link>

      {!decks || decks.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nothing uploaded yet — click Upload material above to get started.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {decks.map((deck) => (
            <li key={deck.id} className="rounded-md border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{MODE_LABELS[deck.mode]}</span>
                <span className="text-xs uppercase text-gray-500">
                  {STATUS_LABELS[deck.status]}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                {new Date(deck.created_at).toLocaleString()} · {deck.style} style
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
