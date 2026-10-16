import { readString, writeString } from "./storage.js";

const CLIENT_ID_KEY = "client-id";

/**
 * Returns an existing anonymous client ID, or generates a new UUID v4
 * and saves it to localStorage so chats remain linked to this browser.
 */
export function getOrCreateClientId() {
  let id = readString(CLIENT_ID_KEY, "");
  if (!id) {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      id = crypto.randomUUID();
    } else {
      id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
    writeString(CLIENT_ID_KEY, id);
  }
  return id;
}

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

async function request(endpoint, options = {}) {
  const clientId = getOrCreateClientId();
  const url = `${BASE_URL}${endpoint}`;

  const headers = {
    "Content-Type": "application/json",
    "X-Client-Id": clientId,
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorMessage =
      data?.error?.message ??
      (typeof data?.error === "string" ? data.error : null) ??
      `Request failed with status ${response.status}`;

    const error = new Error(errorMessage);
    error.status = response.status;
    error.code = data?.error?.code ?? "API_ERROR";
    throw error;
  }

  return data;
}

// -------------------------------------------------------------
// Core API functions as specified in API_SPEC.pdf & Frontend Changes
// -------------------------------------------------------------

export async function listChats() {
  const data = await request("/api/chats", { method: "GET" });
  return Array.isArray(data) ? data : data?.chats ?? [];
}

export async function createChat(id) {
  const data = await request("/api/chats", {
    method: "POST",
    body: id ? JSON.stringify({ id }) : undefined,
  });
  return data?.chat ?? data;
}

export async function getChat(id) {
  const data = await request(`/api/chats/${id}`, { method: "GET" });
  return data?.chat ?? data;
}

export async function deleteChat(id) {
  return request(`/api/chats/${id}`, { method: "DELETE" });
}

export async function renameChat(id, title) {
  const data = await request(`/api/chats/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
  return data?.chat ?? data;
}

export async function sendMessage(chatId, { id, content, model, image }, signal) {
  return request(`/api/chats/${chatId}/messages`, {
    method: "POST",
    body: JSON.stringify({ id, content, model, image }),
    signal,
  });
}

async function consumeSSEStream(response, callbacks = {}, signal) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel().catch(() => {});
        break;
      }

      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() || "";

      for (const frame of frames) {
        if (!frame.trim()) continue;
        const lines = frame.split(/\r?\n/);
        let event = "message";
        let dataStr = "";

        for (const line of lines) {
          if (line.startsWith("event:")) {
            event = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataStr = line.slice(5).trim();
          }
        }

        if (!dataStr) continue;

        try {
          const data = JSON.parse(dataStr);
          if (event === "start") {
            callbacks.onStart?.(data);
          } else if (event === "chunk") {
            callbacks.onChunk?.(data.delta);
          } else if (event === "complete") {
            callbacks.onComplete?.(data);
          } else if (event === "stopped") {
            callbacks.onStopped?.(data);
          } else if (event === "error") {
            callbacks.onError?.(data.error);
          }
        } catch {
          // Ignore malformed JSON frame
        }
      }
    }
  } catch (err) {
    if (signal?.aborted) return;
    throw err;
  }
}

export async function sendMessageStream(
  chatId,
  { id, content, model, image },
  callbacks = {},
  signal
) {
  const clientId = getOrCreateClientId();
  const url = `${BASE_URL}/api/chats/${chatId}/messages/stream`;

  const headers = {
    "Content-Type": "application/json",
    "X-Client-Id": clientId,
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ id, content, model, image }),
    signal,
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = null;
    }
    const msg =
      errorData?.error?.message ??
      (typeof errorData?.error === "string" ? errorData.error : null) ??
      `Request failed with status ${response.status}`;
    const err = new Error(msg);
    err.status = response.status;
    err.code = errorData?.error?.code ?? "STREAM_ERROR";
    throw err;
  }

  return consumeSSEStream(response, callbacks, signal);
}

export async function editMessageStream(
  chatId,
  messageId,
  { content, model },
  callbacks = {},
  signal
) {
  const clientId = getOrCreateClientId();
  const url = `${BASE_URL}/api/chats/${chatId}/messages/${messageId}/stream`;

  const headers = {
    "Content-Type": "application/json",
    "X-Client-Id": clientId,
  };

  const response = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({ content, model }),
    signal,
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = null;
    }
    const msg =
      errorData?.error?.message ??
      (typeof errorData?.error === "string" ? errorData.error : null) ??
      `Request failed with status ${response.status}`;
    const err = new Error(msg);
    err.status = response.status;
    err.code = errorData?.error?.code ?? "STREAM_ERROR";
    throw err;
  }

  return consumeSSEStream(response, callbacks, signal);
}

export async function getMe() {
  const data = await request("/api/me", { method: "GET" });
  return data?.profile;
}

/**
 * Constructs an authenticated image URL for an attachment.
 * Supports local previewUrl or persistent server attachment URL with clientId query param.
 */
export function getAttachmentUrl(attachment) {
  if (!attachment) return null;
  if (attachment.previewUrl) return attachment.previewUrl;
  if (attachment.url) {
    const clientId = getOrCreateClientId();
    const separator = attachment.url.includes("?") ? "&" : "?";
    return `${BASE_URL}${attachment.url}${separator}clientId=${encodeURIComponent(clientId)}`;
  }
  return null;
}

export const api = {
  get: (endpoint, options) => request(endpoint, { method: "GET", ...options }),
  post: (endpoint, body, options) =>
    request(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    }),
  patch: (endpoint, body, options) =>
    request(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    }),
  delete: (endpoint, options) =>
    request(endpoint, { method: "DELETE", ...options }),
  listChats,
  createChat,
  getChat,
  deleteChat,
  renameChat,
  sendMessage,
  sendMessageStream,
  editMessageStream,
  getMe,
  getAttachmentUrl,
};
