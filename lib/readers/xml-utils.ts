// .pptx and .docx files are just zip archives of XML - these two helpers
// are all that's needed to pull plain text out of that XML without a full
// XML parser dependency.

export function decodeXmlEntities(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function extractTagText(xml: string, tagRegex: RegExp): string[] {
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(xml)) !== null) {
    results.push(decodeXmlEntities(match[1]));
  }
  return results;
}
