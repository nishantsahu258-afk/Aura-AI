// Thin, defensive wrapper around window.localStorage.
// Every read/write is try/caught so a corrupted value or a
// privacy-mode browser never crashes the app.

const PREFIX = "aura:";

export function readJSON(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readString(key, fallback = "") {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : raw;
  } catch {
    return fallback;
  }
}

export function writeString(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, value);
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* no-op */
  }
}

export const STORAGE_KEYS = {
  CHATS: "chats", // { [chatId]: Chat }
  CHAT_ORDER: "chat-order", // string[] of chat ids, newest first
  ACTIVE_CHAT: "active-chat",
  API_KEY: "api-key",
  MODEL: "model",
};
