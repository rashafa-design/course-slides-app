import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractContent } from "@/lib/readers";
import type { DeckRow, UploadRow } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  const { deckId } = (await request.json()) as { deckId?: string };
  if (!deckId) {
    return NextResponse.json({ error: "Missing deckId." }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: decks, error: deckError } = await supabase
    .from("decks")
    .select("*")
    .eq("id", deckId)
    .returns<DeckRow[]>();

  const deck = decks?.[0];
  if (deckError || !deck) {
    return NextResponse.json({ error: "Deck not found." }, { status: 404 });
  }

  const { data: uploads, error: uploadsError } = await supabase
    .from("uploads")
    .select("*")
    .in("id", deck.upload_ids)
    .returns<UploadRow[]>();

  if (uploadsError || !uploads) {
    return NextResponse.json({ error: "Could not load uploaded files." }, { status: 500 });
  }

  const textSections: string[] = [];
  const imagePaths: string[] = [];

  for (const upload of uploads) {
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("course-files")
      .download(upload.file_path);

    if (downloadError || !fileBlob) {
      return NextResponse.json(
        { error: `Couldn't download "${upload.file_name}": ${downloadError?.message}` },
        { status: 500 }
      );
    }

    const buffer = Buffer.from(await fileBlob.arrayBuffer());

    let extracted;
    try {
      extracted = await extractContent(upload.file_name, buffer);
    } catch (err) {
      return NextResponse.json(
        { error: `Couldn't read "${upload.file_name}": ${(err as Error).message}` },
        { status: 500 }
      );
    }

    textSections.push(`--- ${upload.file_name} ---\n${extracted.text}`);

    for (let i = 0; i < extracted.images.length; i++) {
      const image = extracted.images[i];
      const path = `${user.id}/extracted/${deckId}/${upload.id}-${i}-${image.fileName}`;
      const { error: imageUploadError } = await supabase.storage
        .from("course-files")
        .upload(path, image.data, { upsert: true });
      if (!imageUploadError) {
        imagePaths.push(path);
      }
    }
  }

  const { error: updateError } = await supabase
    .from("decks")
    .update({
      extracted_text: textSections.join("\n\n"),
      extracted_image_paths: imagePaths,
      updated_at: new Date().toISOString(),
    })
    .eq("id", deckId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
