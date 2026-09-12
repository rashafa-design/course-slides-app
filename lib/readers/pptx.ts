import JSZip from "jszip";
import type { ExtractedContent, ExtractedImage, ExtractedSection } from "./types";
import { extractTagText } from "./xml-utils";

// A slide's own .rels file maps relationship ids (rId1, rId2, ...) to the
// actual media files it uses - this is what lets us say "this specific
// picture belongs to this specific slide" instead of just "here's every
// picture somewhere in the file."
function parseRelationships(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  const tagRegex = /<Relationship\b[^>]*\/>/g;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagRegex.exec(xml)) !== null) {
    const tag = tagMatch[0];
    const id = tag.match(/\bId="([^"]+)"/)?.[1];
    const target = tag.match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) map.set(id, target);
  }
  return map;
}

function extractBlipRelIds(xml: string): string[] {
  const ids: string[] = [];
  const regex = /<a:blip\b[^>]*r:embed="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xml)) !== null) {
    ids.push(m[1]);
  }
  return ids;
}

export async function readPptx(buffer: Buffer): Promise<ExtractedContent> {
  const zip = await JSZip.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const numB = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return numA - numB;
    });

  const sections: ExtractedSection[] = [];

  for (let i = 0; i < slideFiles.length; i++) {
    const slideFileName = slideFiles[i];
    const xml = await zip.files[slideFileName].async("string");

    const paragraphs = xml
      .split(/<\/a:p>/)
      .map((para) => extractTagText(para, /<a:t>([\s\S]*?)<\/a:t>/g).join(" ").trim())
      .filter((line) => line.length > 0);

    const images: ExtractedImage[] = [];
    const slideBaseName = slideFileName.split("/").pop();
    const relsFile = zip.files[`ppt/slides/_rels/${slideBaseName}.rels`];

    if (relsFile) {
      const relIdToTarget = parseRelationships(await relsFile.async("string"));
      const usedRelIds = extractBlipRelIds(xml);

      for (const relId of usedRelIds) {
        const target = relIdToTarget.get(relId);
        if (!target) continue;
        // Targets are relative to ppt/slides/, e.g. "../media/image1.png".
        const mediaPath = target.startsWith("../")
          ? `ppt/${target.slice(3)}`
          : `ppt/slides/${target}`;
        const mediaFile = zip.files[mediaPath];
        if (mediaFile && !mediaFile.dir) {
          images.push({
            fileName: mediaPath.split("/").pop() ?? mediaPath,
            data: await mediaFile.async("nodebuffer"),
          });
        }
      }
    }

    sections.push({ label: `Slide ${i + 1}`, text: paragraphs.join("\n"), images });
  }

  return { sections };
}
