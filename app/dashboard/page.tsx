import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MODE_LABELS, STATUS_LABELS, type DeckRow } from "@/lib/types";
import SignOutButton from "./sign-out-button";
import ProcessButton from "./process-button";

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

  const decksWithImageUrls = await Promise.all(
    (decks ?? []).map(async (deck) => {
      const allPaths = new Set(deck.extracted_image_paths);
      for (const slide of deck.slides_json ?? []) {
        for (const path of slide.images ?? []) allPaths.add(path);
      }

      const entries = await Promise.all(
        Array.from(allPaths).map(async (path) => {
          const { data } = await supabase.storage
            .from("course-files")
            .createSignedUrl(path, 60 * 60);
          return [path, data?.signedUrl ?? null] as const;
        })
      );

      const urlByPath = new Map(entries.filter((entry): entry is [string, string] => Boolean(entry[1])));

      return {
        deck,
        urlByPath,
        imageUrls: deck.extracted_image_paths.map((p) => urlByPath.get(p)).filter((u): u is string => Boolean(u)),
      };
    })
  );

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

      {decksWithImageUrls.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nothing uploaded yet — click Upload material above to get started.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {decksWithImageUrls.map(({ deck, imageUrls, urlByPath }) => (
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

              <ProcessButton deckId={deck.id} status={deck.status} />

              {deck.status === "failed" && deck.error_message && (
                <p className="mt-2 text-xs text-red-600">{deck.error_message}</p>
              )}

              {deck.extracted_text && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-gray-500">
                    Extracted text preview
                  </summary>
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs">
                    {deck.extracted_text.slice(0, 2000)}
                  </pre>
                </details>
              )}

              {deck.slides_json && deck.slides_json.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-gray-500">
                    Slide outline ({deck.slides_json.length} slides)
                  </summary>
                  <ol className="mt-1 flex flex-col gap-2">
                    {deck.slides_json.map((slide, i) => (
                      <li key={i} className="rounded bg-gray-50 p-2 text-xs">
                        <p className="font-medium">
                          {i + 1}. {slide.title}
                        </p>
                        <ul className="ml-4 list-disc">
                          {(slide.bullets ?? []).map((bullet, j) => (
                            <li key={j}>{bullet}</li>
                          ))}
                        </ul>
                        {slide.speakerNotes && (
                          <p className="mt-1 italic text-gray-500">Notes: {slide.speakerNotes}</p>
                        )}
                        {(slide.discussionQuestions ?? []).length > 0 && (
                          <p className="mt-1 text-gray-500">
                            Discuss: {slide.discussionQuestions.join(" / ")}
                          </p>
                        )}
                        {(slide.images ?? []).length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {(slide.images ?? [])
                              .map((path) => urlByPath.get(path))
                              .filter((url): url is string => Boolean(url))
                              .map((url) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  key={url}
                                  src={url}
                                  alt=""
                                  className="h-12 w-12 rounded object-cover"
                                />
                              ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                </details>
              )}

              {imageUrls.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-gray-500">
                    All images found in your material ({imageUrls.length})
                  </summary>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {imageUrls.map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={url}
                        src={url}
                        alt=""
                        className="h-16 w-16 rounded object-cover"
                      />
                    ))}
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
