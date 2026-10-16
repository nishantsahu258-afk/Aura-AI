/**
 * Derive a short chat title from the first user message.
 * Used so sidebar entries read "Plan a trip to Kyoto" instead of "New chat".
 */
export function deriveTitle(text = "") {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return "New chat";
  return clean.length > 42 ? clean.slice(0, 42).trimEnd() + "…" : clean;
}
