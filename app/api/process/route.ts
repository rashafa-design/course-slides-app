import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractContent } from "@/lib/readers";
import { generateSlides } from "@/lib/ai/generate-slides";
import type { DeckRow, UploadRow } from "@/lib/types";

export const maxDuration = 120;

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

  const markFailed = async (message: string) => {
    await supabase
      .from("decks")
      .update({ status: "failed", error_message: message, updated_at: new Date().toISOString() })
      .eq("id", deckId);
  };

  const { data: decks, error: deckError } = await supabase
    .from("decks")
    .select("*")
    .eq("id", deckId)
    .returns<DeckRow[]>();

  const deck = decks?.[0];
  if (deckError || !deck) {
    return NextResponse.json({ error: "Deck not found." }, { status: 404 });
  }

  // Flip to "processing" right away - any other page load for this deck
  // reflects real state from here on, not just this one request's spinner.
  await supabase
    .from("decks")
    .update({ status: "processing", error_message: null, updated_at: new Date().toISOString() })
    .eq("id", deckId);

  const { data: uploads, error: uploadsError } = await supabase
    .from("uploads")
    .select("*")
    .in("id", deck.upload_ids)
    .returns<UploadRow[]>();

  if (uploadsError || !uploads) {
    await markFailed("Could not load uploaded files.");
    return NextResponse.json({ error: "Could not load uploaded files." }, { status: 500 });
  }

  const promptSections: string[] = [];
  const allImagePaths: string[] = [];
  // Maps a source label (e.g. "chapter.pptx :: Slide 3") to the storage
  // paths of images that appeared in that exact section, so we can hand
  // the right pictures back to whichever new slide the AI says came from it.
  const sectionImageMap = new Map<string, string[]>();

  for (const upload of uploads) {
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("course-files")
      .download(upload.file_path);

    if (downloadError || !fileBlob) {
      const message = `Couldn't download "${upload.file_name}": ${downloadError?.message}`;
      await markFailed(message);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const buffer = Buffer.from(await fileBlob.arrayBuffer());

    let extracted;
    try {
      extracted = await extractContent(upload.file_name, buffer);
    } catch (err) {
      const message = `Couldn't read "${upload.file_name}": ${(err as Error).message}`;
      await markFailed(message);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    for (const section of extracted.sections) {
      const label = `${upload.file_name} :: ${section.label}`;
      promptSections.push(`=== ${label} ===\n${section.text}`);

      const sectionPaths: string[] = [];
      for (let i = 0; i < section.images.length; i++) {
        const image = section.images[i];
        const path = `${user.id}/extracted/${deckId}/${upload.id}-${i}-${image.fileName}`;
        const { error: imageUploadError } = await supabase.storage
          .from("course-files")
          .upload(path, image.data, { upsert: true });
        if (!imageUploadError) {
          sectionPaths.push(path);
          allImagePaths.push(path);
        }
      }
      if (sectionPaths.length > 0) {
        sectionImageMap.set(label, sectionPaths);
      }
    }
  }

  let slides;
  try {
    slides = await generateSlides(promptSections.join("\n\n"));
  } catch (err) {
    const message = `Couldn't generate slide content: ${(err as Error).message}`;
    await markFailed(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  for (const slide of slides) {
    const images: string[] = [];
    for (const label of slide.sourceLabels ?? []) {
      const paths = sectionImageMap.get(label);
      if (paths) images.push(...paths);
    }
    slide.images = images;
  }

  const { error: updateError } = await supabase
    .from("decks")
    .update({
      extracted_text: promptSections.join("\n\n"),
      extracted_image_paths: allImagePaths,
      slides_json: slides,
      status: "ready",
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", deckId);

  if (updateError) {
    await markFailed(updateError.message);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
