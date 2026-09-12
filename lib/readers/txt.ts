import type { ExtractedContent } from "./types";

export async function readTxt(buffer: Buffer): Promise<ExtractedContent> {
  return { text: buffer.toString("utf-8"), images: [] };
}
