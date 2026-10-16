/**
 * Utilities for exporting Aura AI chat conversations to Markdown (.md) and Plain Text (.txt)
 * using the browser's native Blob and download APIs.
 *
 * Rules:
 * - Pure frontend implementation (zero backend routes, DB changes, or external libraries).
 * - Preserves message order, chat title, timestamps, and code blocks.
 * - Formats image attachment metadata (name, mimeType, size) without image binaries.
 * - Safely handles empty chats and sanitizes filenames across OS file systems.
 * - Cleans up temporary object URLs immediately after download.
 */

const FORBIDDEN_FILENAME_CHARS = new Set(["\\", "/", ":", "*", "?", '"', "<", ">", "|"]);

/**
 * Sanitizes a title string into a safe, cross-platform filename.
 * Strips Windows/Unix forbidden characters: < > : " / \ | ? * and ASCII control characters.
 */
export function sanitizeFilename(name = "", fallback = "aura-chat") {
  if (typeof name !== "string") return fallback;

  const cleaned = Array.from(name)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127 && !FORBIDDEN_FILENAME_CHARS.has(char);
    })
    .join("")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");

  return cleaned.slice(0, 80) || fallback;
}

/**
 * Formats byte size into human-readable string (KB or MB).
 */
export function formatFileSize(bytes) {
  if (typeof bytes !== "number" || bytes <= 0) return null;
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

/**
 * Formats attachment metadata for text/markdown export without binaries.
 */
export function formatAttachmentMetadata(attachment) {
  if (!attachment || typeof attachment !== "object") return "";
  const name = attachment.name || "image";
  const type = attachment.mimeType || attachment.type || "";
  const sizeStr = formatFileSize(attachment.size);

  const details = [type, sizeStr].filter(Boolean).join(", ");
  return details ? `${name} (${details})` : name;
}

/**
 * Formats a chat object into a GitHub-flavored Markdown (.md) document.
 */
export function formatChatAsMarkdown(chat) {
  const title = chat?.title?.trim() || "Untitled Chat";
  const messages = Array.isArray(chat?.messages) ? chat.messages : [];
  const exportDate = new Date().toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });

  const lines = [
    `# ${title}`,
    "",
    `_Exported from Aura AI on ${exportDate}_`,
    "",
    "---",
    "",
  ];

  if (messages.length === 0) {
    lines.push("*(No messages in this conversation yet)*", "");
    return lines.join("\n");
  }

  messages.forEach((msg, idx) => {
    const isUser = msg.role === "user";
    const sender = isUser ? "You" : "Aura";
    const timeStr = msg.timestamp
      ? ` • _${new Date(msg.timestamp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}_`
      : "";

    lines.push(`### ${sender}${timeStr}`, "");

    if (msg.attachment) {
      const meta = formatAttachmentMetadata(msg.attachment);
      lines.push(`> 📎 **Attached Image:** ${meta}`, "");
    }

    const content = typeof msg.content === "string" ? msg.content.trim() : "";
    if (content) {
      lines.push(content, "");
    }

    if (idx < messages.length - 1) {
      lines.push("---", "");
    }
  });

  return lines.join("\n");
}

/**
 * Formats a chat object into a clean, structured Plain Text (.txt) document.
 */
export function formatChatAsText(chat) {
  const title = chat?.title?.trim() || "Untitled Chat";
  const messages = Array.isArray(chat?.messages) ? chat.messages : [];
  const exportDate = new Date().toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });

  const divider = "=".repeat(78);
  const turnDivider = "-".repeat(78);

  const lines = [
    divider,
    `AURA AI CONVERSATION: ${title}`,
    `Exported: ${exportDate}`,
    divider,
    "",
  ];

  if (messages.length === 0) {
    lines.push("(No messages in this conversation yet)", "", divider);
    return lines.join("\n");
  }

  messages.forEach((msg, idx) => {
    const isUser = msg.role === "user";
    const sender = isUser ? "YOU" : "AURA";
    const timeStr = msg.timestamp
      ? ` (${new Date(msg.timestamp).toLocaleString()})`
      : "";

    lines.push(`[${sender}]${timeStr}`);

    if (msg.attachment) {
      const meta = formatAttachmentMetadata(msg.attachment);
      lines.push(`[Attached Image: ${meta}]`);
    }

    const content = typeof msg.content === "string" ? msg.content.trim() : "";
    if (content) {
      lines.push(content);
    }

    lines.push("");

    if (idx < messages.length - 1) {
      lines.push(turnDivider, "");
    }
  });

  lines.push(divider, "End of conversation", divider, "");
  return lines.join("\n");
}

/**
 * Triggers a file download using native browser Blob and URL.createObjectURL.
 * Cleans up temporary object URLs immediately after triggering download.
 */
export function downloadFile(content, filename, mimeType = "text/plain;charset=utf-8") {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);

  try {
    link.click();
  } finally {
    // Revoke the temporary object URL and remove anchor element
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(objectUrl);
    }, 150);
  }
}

/**
 * Main export function for an Aura chat session.
 * @param {Object} chat The chat object
 * @param {"markdown" | "text"} format The desired format ("markdown" | "text")
 * @returns {boolean} Whether download was initiated
 */
export function exportChat(chat, format = "markdown") {
  if (!chat) return false;

  const titleFallback = `aura-chat-${chat.id || chat.chatId || "export"}`;
  const baseName = sanitizeFilename(chat.title, titleFallback);

  if (format === "markdown") {
    const content = formatChatAsMarkdown(chat);
    downloadFile(content, `${baseName}.md`, "text/markdown;charset=utf-8");
    return true;
  }

  if (format === "text") {
    const content = formatChatAsText(chat);
    downloadFile(content, `${baseName}.txt`, "text/plain;charset=utf-8");
    return true;
  }

  return false;
}
