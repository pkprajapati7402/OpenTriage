import crypto from "crypto";

export function sha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function cacheKey(parts: (string | number | boolean | undefined | null)[]): string {
  const normalized = parts.map((p) => String(p ?? "")).join("::");
  return sha256(normalized);
}
