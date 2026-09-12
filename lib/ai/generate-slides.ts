import Anthropic from "@anthropic-ai/sdk";
import type { SlideContent } from "@/lib/types";

const SYSTEM_PROMPT = `You turn raw course material into simple, teachable slide content for a college instructor.

Given the source text, produce a JSON array of slides. Each slide is an object with:
- "title": a short slide title
- "bullets": an array of short, plain-language bullet points (simplify the language - don't just shorten it)
- "speakerNotes": a short paragraph of talking points the instructor can glance at while presenting
- "discussionQuestions": 0-2 questions to prompt class discussion, only when genuinely relevant (can be an empty array)

Aim for one slide per major concept - don't pad with filler slides, and don't cram unrelated ideas onto one slide.

Respond with ONLY the JSON array. No markdown code fences, no other text.`;

export async function generateSlides(sourceText: string): Promise<SlideContent[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("No Anthropic API key is configured yet.");
  }

  const anthropic = new Anthropic({ apiKey });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: sourceText }],
  });

  let raw = "";
  for (const block of response.content) {
    if (block.type === "text") {
      raw += block.text;
    }
  }

  if (!raw.trim()) {
    throw new Error("The AI didn't return any text.");
  }

  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("The AI's response wasn't valid JSON.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("The AI's response wasn't a list of slides.");
  }

  return parsed as SlideContent[];
}
