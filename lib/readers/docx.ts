import JSZip from "jszip";
import type { ExtractedContent, ExtractedImage } from "./types";
import { extractTagText } from "./xml-utils";

export async function readDocx(buffer: Buffer): Promise<ExtractedContent> {
  const zip = await JSZip.loadAsync(buffer);

  const docFile = zip.files["word/document.xml"];
  let text = "";
  if (docFile) {
    const xml = await docFile.async("string");
    // Split on paragraph boundaries first, otherwise every paragraph's
    // text runs get concatenated into one unreadable block.
    const paragraphs = xml
      .split(/<\/w:p>/)
      .map((para) => extractTagText(para, /<w:t[^>]*>([\s\S]*?)<\/w:t>/g).join(""))
      .filter((line) => line.trim().length > 0);

    text = paragraphs.join("\n");
  }

  const images: ExtractedImage[] = [];
  for (const fileName of Object.keys(zip.files)) {
    if (!fileName.startsWith("word/media/")) continue;
    const file = zip.files[fileName];
    if (file.dir) continue;
    images.push({
      fileName: fileName.split("/").pop() ?? fileName,
      data: await file.async("nodebuffer"),
    });
  }

  return { text, images };
}
