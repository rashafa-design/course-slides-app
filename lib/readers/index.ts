import type { ExtractedContent } from "./types";
import { readPptx } from "./pptx";
import { readDocx } from "./docx";
import { readPdf } from "./pdf";
import { readTxt } from "./txt";

export async function extractContent(
  fileName: string,
  buffer: Buffer
): Promise<ExtractedContent> {
  const extension = fileName.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "pptx":
      return readPptx(buffer);
    case "docx":
      return readDocx(buffer);
    case "pdf":
      return readPdf(buffer);
    case "txt":
      return readTxt(buffer);
    default:
      throw new Error(`Don't know how to read a ".${extension}" file yet.`);
  }
}

export type { ExtractedContent, ExtractedImage } from "./types";
