export interface TruncateOptions {
  headChars?: number;
  tailChars?: number;
}

export function truncateBody(
  body: string,
  options: TruncateOptions = { headChars: 1200, tailChars: 300 }
): { text: string; truncated: boolean } {
  if (!body) return { text: "", truncated: false };

  const { headChars = 1200, tailChars = 300 } = options;
  const totalLimit = headChars + tailChars;

  if (body.length <= totalLimit) {
    return { text: body, truncated: false };
  }

  const head = body.slice(0, headChars);
  const tail = tailChars > 0 ? body.slice(-tailChars) : "";
  const omitted = body.length - headChars - tailChars;

  const text = `${head}\n\n[... ${omitted} characters truncated for triage context ...]\n\n${tail}`;
  return { text, truncated: true };
}

export function sanitizePromptText(text: string): string {
  if (!text) return "";
  // Strip control characters, normalize newlines, avoid XML closing injections
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/<\/item>/gi, "<\\/item>")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .trim();
}
