// System instruction and prompt formatting for Aura AI

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
 * Convert chat message history into Gemini API contents structure.
 * Caps to maximum 50 most recent history items to protect quota (Security S2).
 * Accepts optional currentImage { mimeType, data } and attachmentsMap (Map or Object of attachmentId -> { mimeType, data })
 * for persistent multimodal vision across follow-up turns.
 */
export function buildContents(messages = [], currentImage = null, attachmentsMap = null) {
  const valid = messages.filter(
    (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
  );

  // Take up to the last 50 messages
  const sliced = valid.slice(-50);

  return sliced.map((m, index) => {
    const isLast = index === sliced.length - 1;
    const parts = [];

    // Resolve image data for this turn:
    // 1. Explicit currentImage for the latest turn
    // 2. Persistent image from attachmentsMap for earlier turns or restored turns
    let turnImage = null;
    if (isLast && m.role === "user" && currentImage?.data && currentImage?.mimeType) {
      turnImage = currentImage;
    } else if (m.role === "user" && m.attachment?.id && attachmentsMap) {
      const att =
        attachmentsMap instanceof Map
          ? attachmentsMap.get(m.attachment.id)
          : attachmentsMap[m.attachment.id];
      if (att?.data && att?.mimeType) {
        turnImage = att;
      }
    }

    if (turnImage) {
      parts.push({
        inlineData: {
          mimeType: turnImage.mimeType,
          data: turnImage.data,
        },
      });
    }

    const textContent = m.content?.trim();
    if (textContent) {
      parts.push({ text: textContent });
    } else if (parts.length > 0) {
      parts.push({ text: "Describe this image." });
    } else {
      parts.push({ text: "" });
    }

    return {
      role: m.role === "assistant" ? "model" : "user",
      parts,
    };
  });
}

/**
 * Derive a clean title from the first message
 */
export function deriveTitle(text = "") {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return "New chat";
  return clean.length > 42 ? clean.slice(0, 42).trimEnd() + "…" : clean;
}
