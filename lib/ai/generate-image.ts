// Gemini specifically because its free tier needs no billing setup at all -
// unlike Anthropic's, which requires prepaid credit from the first call.
// The tradeoff is a real, low, shared rate limit: ImageQuotaExceededError
// signals "stop trying for now," not "something broke."

const DEFAULT_MODEL = "gemini-2.5-flash-image";

export class ImageQuotaExceededError extends Error {}

export async function generateImage(prompt: string): Promise<Buffer | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  });

  if (response.status === 429) {
    const body = await response.text();
    throw new ImageQuotaExceededError(
      `Gemini's free image-generation limit was reached: ${body.slice(0, 400)}`
    );
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini image request failed (${response.status}): ${body.slice(0, 400)}`);
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[];
  };
  const parts = data.candidates?.[0]?.content?.parts ?? [];

  for (const part of parts) {
    if (part.inlineData?.data) {
      return Buffer.from(part.inlineData.data, "base64");
    }
  }

  return null;
}
