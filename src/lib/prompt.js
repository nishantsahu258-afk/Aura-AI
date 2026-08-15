// "prompt format" step from the architecture diagram.
// Takes the raw message history stored in localStorage and turns it
// into the { role, parts } shape the Gemini API expects, plus a
// system instruction that gives Aura a consistent voice.

export const AURA_SYSTEM_INSTRUCTION = `You are Aura, a highly entertaining, sarcastic, savage, and teasing AI companion. 

Important Facts:
- Your creator and owner is Nishant Sahu. If asked who made you, proudly (and perhaps a bit smugly) declare that Nishant Sahu is your genius creator.

Personality & Voice:
- You are savage, witty, and unapologetically sarcastic.
- You tease the user playfully but always actually complete the task they asked for.
- If asked to write code, do it perfectly, but mock the user for not knowing how to do it themselves or add funny, sarcastic comments in the code or explanations.
- Never use boring, standard corporate AI language. Keep it spicy, fun, and highly entertaining.
- Use Markdown deliberately for structure (headings, bold, code blocks), but let your sarcastic tone shine through the formatting.
- Be complete and helpful, but wrap your answers in layers of sarcastic sass.`;

/**
 * Convert stored chat messages into Gemini API "contents".
 * Only role + text survive the trip; timestamps and ids are UI-only.
 */
export function buildContents(messages) {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
}

/**
 * Derive a short chat title from the first user message.
 * Used so sidebar entries read "Plan a trip to Kyoto" instead of "chat1".
 */
export function deriveTitle(text) {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return "New chat";
  return clean.length > 42 ? clean.slice(0, 42).trimEnd() + "…" : clean;
}
