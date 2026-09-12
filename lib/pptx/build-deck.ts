import PptxGenJS from "pptxgenjs";
import type { SlideContent, DeckStyle } from "@/lib/types";
import type { ExtractedImage } from "@/lib/readers";

function mimeFor(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
    default:
      return "image/png";
  }
}

export async function buildDeck(
  slides: SlideContent[],
  imagesBySlide: ExtractedImage[][],
  style: DeckStyle
): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
  pptx.layout = "WIDE";

  const isBranded = style === "branded";
  const accentColor = "1F4E5F";
  const titleColor = isBranded ? "FFFFFF" : "1A1A1A";

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const images = imagesBySlide[i] ?? [];
    const pptxSlide = pptx.addSlide();

    if (isBranded) {
      pptxSlide.addShape("rect", {
        x: 0,
        y: 0,
        w: "100%",
        h: 1.1,
        fill: { color: accentColor },
        line: { color: accentColor },
      });
    }

    pptxSlide.addText(slide.title || `Slide ${i + 1}`, {
      x: 0.5,
      y: isBranded ? 0.15 : 0.3,
      w: "90%",
      h: 0.8,
      fontSize: 28,
      bold: true,
      color: titleColor,
      fontFace: "Arial",
    });

    const hasImage = images.length > 0;
    const bodyWidth = hasImage ? 6.5 : 12;

    if ((slide.bullets ?? []).length > 0) {
      pptxSlide.addText(
        slide.bullets.map((b) => ({
          text: b,
          options: { bullet: true, breakLine: true, paraSpaceAfter: 14 },
        })),
        {
          x: 0.5,
          y: 1.4,
          w: bodyWidth,
          h: 4.7,
          fontSize: 18,
          color: "1A1A1A",
          fontFace: "Arial",
          valign: "top",
          shrinkText: true,
        }
      );
    }

    if ((slide.discussionQuestions ?? []).length > 0) {
      pptxSlide.addText(`Discuss: ${slide.discussionQuestions.join("  /  ")}`, {
        x: 0.5,
        y: 6.3,
        w: bodyWidth,
        h: 0.9,
        fontSize: 13,
        italic: true,
        color: "555555",
        fontFace: "Arial",
      });
    }

    if (hasImage) {
      const image = images[0];
      pptxSlide.addImage({
        data: `data:${mimeFor(image.fileName)};base64,${image.data.toString("base64")}`,
        x: 7.3,
        y: 1.4,
        w: 5.3,
        h: 4.8,
        sizing: { type: "contain", w: 5.3, h: 4.8 },
      });
    }

    if (slide.speakerNotes) {
      pptxSlide.addNotes(slide.speakerNotes);
    }
  }

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
