import type { ExtractedContent } from "./types";

export async function readTxt(buffer: Buffer): Promise<ExtractedContent> {
  return { sections: [{ label: "Document", text: buffer.toString("utf-8"), images: [] }] };
}
