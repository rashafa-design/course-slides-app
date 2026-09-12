import pdfParse from "pdf-parse/lib/pdf-parse.js";
import type { ExtractedContent } from "./types";

// Text only for now - pulling images back out of a PDF needs much heavier
// tooling (a renderer, effectively) than the zip-of-XML trick that works
// for .pptx/.docx. Revisit if image reuse from PDFs turns out to matter.
export async function readPdf(buffer: Buffer): Promise<ExtractedContent> {
  const result = await pdfParse(buffer);
  return { text: result.text, images: [] };
}
