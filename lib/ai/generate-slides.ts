import Anthropic from "@anthropic-ai/sdk";
import type { SlideContent } from "@/lib/types";

const SYSTEM_PROMPT = `You turn raw course material into simple, teachable slide content for a college instructor.

You'll be given source material broken into labeled sections. Produce a slide deck: each slide should cover one major concept - don't pad with filler slides, and don't cram unrelated ideas onto one slide. A single slide can draw from one or several source sections.

For each slide, write a short title, plain-language bullet points (simplify the language - don't just shorten it), speaker notes (a short paragraph of talking points the instructor can glance at while presenting), 0-2 discussion questions only when genuinely relevant, and which source section(s) it was drawn from.`;

export interface SourceSection {
  label: string;
  text: string;
}

export async function generateSlides(
  sections: SourceSection[],
  instructions?: string | null
): Promise<SlideContent[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("No Anthropic API key is configured yet.");
  }

  const labels = sections.map((s) => s.label);
  let sourceText = sections.map((s) => `=== ${s.label} ===\n${s.text}`).join("\n\n");

  if (instructions && instructions.trim()) {
    sourceText =
      `The instructor gave these specific instructions - follow them closely, ` +
      `even ahead of the general guidance above where they conflict (for example, ` +
      `a requested slide count overrides "one slide per major concept"):\n"${instructions.trim()}"\n\n` +
      sourceText;
  }

  const anthropic = new Anthropic({ apiKey });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    // A big requested slide count (e.g. "40 slides") needs real room -
    // each slide's title/bullets/notes/questions adds up fast, and a
    // truncated response means an incomplete tool call further down.
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: sourceText }],
    tools: [
      {
        name: "produce_slides",
        description: "Return the finished slide deck.",
        input_schema: {
          type: "object",
          properties: {
            slides: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  bullets: { type: "array", items: { type: "string" } },
                  speakerNotes: { type: "string" },
                  discussionQuestions: { type: "array", items: { type: "string" } },
                  // Constraining this to the real label list (rather than
                  // asking the model to retype long strings correctly)
                  // is what makes the image matching afterward reliable.
                  sourceLabels: {
                    type: "array",
                    items: { type: "string", enum: labels },
                  },
                },
                required: ["title", "bullets", "speakerNotes", "discussionQuestions", "sourceLabels"],
              },
            },
          },
          required: ["slides"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "produce_slides" },
  });

  for (const block of response.content) {
    if (block.type === "tool_use" && block.name === "produce_slides") {
      const input = block.input as { slides?: SlideContent[] };
      if (Array.isArray(input.slides) && input.slides.length > 0) {
        return input.slides;
      }
    }
  }

  // stop_reason tells us why, e.g. "max_tokens" means the response got cut
  // off mid-generation (too many slides requested for the space given) -
  // surface that instead of a generic, undiagnosable failure.
  throw new Error(`The AI didn't return any slides (stop reason: ${response.stop_reason}).`);
}
