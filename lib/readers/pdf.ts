import pdfParse from "pdf-parse/lib/pdf-parse.js";
import type { ExtractedContent } from "./types";

// Text only - pulling images back out of a PDF needs much heavier tooling
// (a renderer, effectively) than the zip-of-XML trick that works for
// .pptx/.docx. Not a gap in practice: reuse-only mode mainly matters for
// .pptx rebuilds anyway.
export async function readPdf(buffer: Buffer): Promise<ExtractedContent> {
  const result = await pdfParse(buffer);
  return { sections: [{ label: "Document", text: result.text, images: [] }] };
}
