import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractContent, type ExtractedImage } from "@/lib/readers";
import { generateSlides, type SourceSection } from "@/lib/ai/generate-slides";
import { buildDeck } from "@/lib/pptx/build-deck";
import { generateImage, ImageQuotaExceededError } from "@/lib/ai/generate-image";
import type { DeckRow, UploadRow } from "@/lib/types";

export const maxDuration = 300;

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

  const sourceSections: SourceSection[] = [];
  const allImagePaths: string[] = [];
  // Maps a source label (e.g. "chapter.pptx :: Slide 3") to the images that
  // appeared in that exact section - keeping both the storage path (for the
  // database/gallery) and the raw bytes (for embedding into the .pptx
  // itself, further down) so we don't have to re-download anything.
  const sectionImageMap = new Map<string, { path: string; image: ExtractedImage }[]>();

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
      sourceSections.push({ label, text: section.text });

      const sectionImages: { path: string; image: ExtractedImage }[] = [];
      for (let i = 0; i < section.images.length; i++) {
        const image = section.images[i];
        const path = `${user.id}/extracted/${deckId}/${upload.id}-${i}-${image.fileName}`;
        const { error: imageUploadError } = await supabase.storage
          .from("course-files")
          .upload(path, image.data, { upsert: true });
        if (!imageUploadError) {
          sectionImages.push({ path, image });
          allImagePaths.push(path);
        }
      }
      if (sectionImages.length > 0) {
        sectionImageMap.set(label, sectionImages);
      }
    }
  }

  let slides;
  try {
    slides = await generateSlides(sourceSections, deck.instructions);
  } catch (err) {
    const message = `Couldn't generate slide content: ${(err as Error).message}`;
    await markFailed(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const imagesBySlide: ExtractedImage[][] = [];
  for (const slide of slides) {
    const matched = (slide.sourceLabels ?? []).flatMap((label) => sectionImageMap.get(label) ?? []);
    slide.images = matched.map((m) => m.path);
    imagesBySlide.push(matched.map((m) => m.image));
  }

  // For slides with no real diagram to reuse, try generating one - but the
  // moment the free tier's limit is hit, stop asking for more rather than
  // failing the whole deck over it. Slides after that point just go without.
  const MAX_GENERATION_ATTEMPTS = 5;
  let imageGenerationNote: string | null = null;
  let quotaHit = false;
  let attempts = 0;

  for (let i = 0; i < slides.length; i++) {
    if (quotaHit || imagesBySlide[i].length > 0) continue;
    if (attempts >= MAX_GENERATION_ATTEMPTS) break;
    attempts++;

    const slide = slides[i];
    const prompt =
      `A simple, clean educational illustration for a college course slide titled "${slide.title}". ` +
      `Key points: ${(slide.bullets ?? []).join("; ")}. Flat, minimal, presentation-appropriate style, no text in the image.`;

    try {
      const imageBuffer = await generateImage(prompt);
      if (imageBuffer) {
        const path = `${user.id}/generated/${deckId}/${i}.png`;
        const { error: genUploadError } = await supabase.storage
          .from("course-files")
          .upload(path, imageBuffer, { upsert: true, contentType: "image/png" });
        if (!genUploadError) {
          slide.images = [path];
          allImagePaths.push(path);
          imagesBySlide[i] = [{ fileName: `${i}.png`, data: imageBuffer }];
        }
      }
    } catch (err) {
      if (err instanceof ImageQuotaExceededError) {
        quotaHit = true;
        imageGenerationNote = (err as Error).message;
      } else {
        // Surface it rather than hide it, at least for the first failure -
        // otherwise a real bug (bad model name, bad key) looks identical
        // to "no image was needed here."
        imageGenerationNote ??= `Image generation failed: ${(err as Error).message}`;
      }
    }
  }

  let deckBuffer: Buffer;
  try {
    deckBuffer = await buildDeck(slides, imagesBySlide, deck.style);
  } catch (err) {
    const message = `Couldn't assemble the PowerPoint file: ${(err as Error).message}`;
    await markFailed(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const deckFilePath = `${user.id}/decks/${deckId}/deck.pptx`;
  const { error: deckUploadError } = await supabase.storage
    .from("course-files")
    .upload(deckFilePath, deckBuffer, {
      upsert: true,
      contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });

  if (deckUploadError) {
    const message = `Couldn't save the finished file: ${deckUploadError.message}`;
    await markFailed(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("decks")
    .update({
      extracted_text: sourceSections.map((s) => `=== ${s.label} ===\n${s.text}`).join("\n\n"),
      extracted_image_paths: allImagePaths,
      slides_json: slides,
      deck_file_path: deckFilePath,
      image_generation_note: imageGenerationNote,
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
