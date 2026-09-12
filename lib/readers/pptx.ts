import JSZip from "jszip";
import type { ExtractedContent, ExtractedImage } from "./types";
import { extractTagText } from "./xml-utils";

export async function readPptx(buffer: Buffer): Promise<ExtractedContent> {
  const zip = await JSZip.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const numB = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return numA - numB;
    });

  const slideTexts: string[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async("string");
    // Split on paragraph boundaries first so each bullet/line stays on its
    // own line, rather than every run on the slide running together.
    const paragraphs = xml
      .split(/<\/a:p>/)
      .map((para) => extractTagText(para, /<a:t>([\s\S]*?)<\/a:t>/g).join(" ").trim())
      .filter((line) => line.length > 0);

    slideTexts.push(`Slide ${i + 1}:\n${paragraphs.join("\n")}`);
  }

  const images: ExtractedImage[] = [];
  for (const fileName of Object.keys(zip.files)) {
    if (!fileName.startsWith("ppt/media/")) continue;
    const file = zip.files[fileName];
    if (file.dir) continue;
    images.push({
      fileName: fileName.split("/").pop() ?? fileName,
      data: await file.async("nodebuffer"),
    });
  }

  return { text: slideTexts.join("\n\n"), images };
}
