import { AURA_SYSTEM_INSTRUCTION } from "./prompt.js";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const FETCH_TIMEOUT_MS = 30_000;

export const ALLOWED_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

export class GeminiError extends Error {
  constructor(message, status = 500, code = "GEMINI_ERROR") {
    super(message);
    this.name = "GeminiError";
    this.status = status;
    this.code = code;
  }
}

// In-memory daily counter to enforce optional DAILY_MESSAGE_CAP
let currentDay = new Date().toISOString().slice(0, 10);
let dailyMessageCount = 0;

function checkDailyCap() {
  const cap = parseInt(process.env.DAILY_MESSAGE_CAP, 10);
  if (!cap || isNaN(cap)) return;

  const today = new Date().toISOString().slice(0, 10);
  if (today !== currentDay) {
    currentDay = today;
    dailyMessageCount = 0;
  }

  if (dailyMessageCount >= cap) {
    throw new GeminiError(
      "Daily global message quota reached. Please try again tomorrow.",
      429,
      "DAILY_CAP_REACHED"
    );
  }
}

function recordDailyUse() {
  dailyMessageCount++;
}

async function fetchWithTimeout(url, options, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const combinedSignal = options.signal
    ? AbortSignal.any
      ? AbortSignal.any([options.signal, controller.signal])
      : controller.signal
    : controller.signal;

  try {
    const response = await fetch(url, { ...options, signal: combinedSignal });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

function isRetryableNetworkError(err) {
  if (err.name === "AbortError") return false;
  const msg = (err.message || "").toLowerCase();
  return (
    err instanceof TypeError ||
    msg.includes("network") ||
    msg.includes("failed to fetch") ||
    msg.includes("load failed") ||
    msg.includes("connection") ||
    msg.includes("stream") ||
    msg.includes("socket") ||
    msg.includes("econnreset") ||
    msg.includes("wsarecv")
  );
}

export async function sendGeminiMessage({
  model = "gemini-2.5-flash",
  contents,
  systemInstruction = AURA_SYSTEM_INSTRUCTION,
  signal,
}) {
  checkDailyCap();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError(
      "Server configuration error: GEMINI_API_KEY is missing.",
      500,
      "CONFIG_ERROR"
    );
  }

  // Check against model allowlist (FR-7)
  const primaryModel = ALLOWED_MODELS.includes(model) ? model : "gemini-3.5-flash";

  const modelsToTry = [
    ...new Set([
      primaryModel,
      "gemini-3.5-flash",
      "gemini-3.8-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.7-flash",
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
    ]),
  ];

  const body = {
    contents,
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      maxOutputTokens: 2048,
    },
  };

  if (systemInstruction) {
    body.systemInstruction = {
      role: "system",
      parts: [{ text: systemInstruction }],
    };
  }

  const payload = JSON.stringify(body);
  let lastErrorMsg = "Gemini API is currently experiencing high demand. Please try again in a moment.";

  for (const currentModel of modelsToTry) {
    const url = `${BASE_URL}/${currentModel}:generateContent?key=${encodeURIComponent(apiKey)}`;

    for (let attempt = 1; attempt <= 3; attempt++) {
      let response;
      try {
        response = await fetchWithTimeout(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          signal,
        });
      } catch (err) {
        if (err.name === "AbortError" && signal?.aborted) throw err;

        if (isRetryableNetworkError(err) && attempt < 3) {
          await new Promise((r) => setTimeout(r, attempt * 1000));
          continue;
        }

        lastErrorMsg = "Connection to Gemini timed out. Trying next available model…";
        break;
      }

      let data;
      try {
        data = await response.json();
      } catch {
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        lastErrorMsg = "Received an incomplete response from Gemini.";
        break;
      }

      if (!response.ok) {
        const apiMessage = data?.error?.message || "";

        if (response.status === 503 || response.status === 429) {
          lastErrorMsg = "This model is under high demand. Switching to a backup model…";
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 1500 * attempt));
            continue;
          }
          break;
        }

        if (response.status === 404) {
          lastErrorMsg = apiMessage || `Model unavailable (${response.status})`;
          break;
        }

        if (response.status === 400) {
          throw new GeminiError(
            apiMessage || "Bad Request. Please check your prompt and try again.",
            400,
            "BAD_REQUEST"
          );
        }

        if (response.status === 401 || response.status === 403) {
          throw new GeminiError(
            "Gemini authentication failed on server. Please check GEMINI_API_KEY.",
            500,
            "AUTH_ERROR"
          );
        }

        throw new GeminiError(
          apiMessage || `Gemini error (${response.status}).`,
          response.status,
          "API_ERROR"
        );
      }

      const candidate = data?.candidates?.[0];
      const text =
        candidate?.content?.parts?.map((p) => p.text || "").join("") ?? "";

      if (!text) {
        const blockReason = data?.promptFeedback?.blockReason;
        if (blockReason) {
          throw new GeminiError(
            `Gemini declined to answer (${blockReason.toLowerCase()}).`,
            400,
            "CONTENT_BLOCKED"
          );
        }

        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        throw new GeminiError("Gemini returned an empty response.", 500, "EMPTY_RESPONSE");
      }

      recordDailyUse();
      return text;
    }
  }

  throw new GeminiError(lastErrorMsg, 503, "SERVICE_UNAVAILABLE");
}

export async function* streamGeminiMessage({
  model = "gemini-3.5-flash",
  contents,
  systemInstruction = AURA_SYSTEM_INSTRUCTION,
  signal,
}) {
  checkDailyCap();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError(
      "Server configuration error: GEMINI_API_KEY is missing.",
      500,
      "CONFIG_ERROR"
    );
  }

  const primaryModel = ALLOWED_MODELS.includes(model) ? model : "gemini-3.5-flash";

  const modelsToTry = [
    ...new Set([
      primaryModel,
      "gemini-3.5-flash",
      "gemini-3.8-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.7-flash",
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
    ]),
  ];

  const body = {
    contents,
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      maxOutputTokens: 2048,
    },
  };

  if (systemInstruction) {
    body.systemInstruction = {
      role: "system",
      parts: [{ text: systemInstruction }],
    };
  }

  const payload = JSON.stringify(body);
  let lastErrorMsg = "Gemini API is currently experiencing high demand. Please try again in a moment.";

  for (const currentModel of modelsToTry) {
    if (signal?.aborted) return;

    const url = `${BASE_URL}/${currentModel}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

    for (let attempt = 1; attempt <= 3; attempt++) {
      if (signal?.aborted) return;

      let response;
      try {
        response = await fetchWithTimeout(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          signal,
        });
      } catch (err) {
        if (err.name === "AbortError" && signal?.aborted) return;

        if (isRetryableNetworkError(err) && attempt < 3) {
          await new Promise((r) => setTimeout(r, attempt * 1000));
          continue;
        }

        lastErrorMsg = "Connection to Gemini timed out. Trying next available model…";
        break;
      }

      if (!response.ok) {
        let errData;
        try {
          errData = await response.json();
        } catch {
          errData = null;
        }

        const apiMessage = errData?.error?.message || "";

        if (response.status === 503 || response.status === 429) {
          lastErrorMsg = "This model is under high demand. Switching to a backup model…";
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 1200 * attempt));
            continue;
          }
          break;
        }

        if (response.status === 404) {
          lastErrorMsg = apiMessage || `Model unavailable (${response.status})`;
          break;
        }

        if (response.status === 400) {
          throw new GeminiError(
            apiMessage || "Bad Request. Please check your prompt and try again.",
            400,
            "BAD_REQUEST"
          );
        }

        if (response.status === 401 || response.status === 403) {
          throw new GeminiError(
            "Gemini authentication failed on server. Please check GEMINI_API_KEY.",
            500,
            "AUTH_ERROR"
          );
        }

        throw new GeminiError(
          apiMessage || `Gemini error (${response.status}).`,
          response.status,
          "API_ERROR"
        );
      }

      // We have a 200 SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamedAny = false;

      try {
        while (true) {
          if (signal?.aborted) {
            await reader.cancel().catch(() => {});
            return;
          }

          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split(/\r?\n\r?\n/);
          buffer = parts.pop() || "";

          for (const block of parts) {
            for (const line of block.split(/\r?\n/)) {
              if (line.startsWith("data:")) {
                try {
                  const data = JSON.parse(line.slice(5).trim());
                  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("");
                  if (text) {
                    streamedAny = true;
                    yield text;
                  }
                } catch {
                  // Partial JSON ignored
                }
              }
            }
          }
        }

        // Flush remaining buffer
        buffer += decoder.decode();
        if (buffer.trim()) {
          for (const line of buffer.split(/\r?\n/)) {
            if (line.startsWith("data:")) {
              try {
                const data = JSON.parse(line.slice(5).trim());
                const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("");
                if (text) {
                  streamedAny = true;
                  yield text;
                }
              } catch {}
            }
          }
        }

        if (streamedAny) {
          recordDailyUse();
          return;
        }
      } catch (streamErr) {
        if (signal?.aborted) return;
        if (isRetryableNetworkError(streamErr) && attempt < 3 && !streamedAny) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        throw streamErr;
      }

      if (!streamedAny) {
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        break;
      }
    }
  }

  throw new GeminiError(lastErrorMsg, 503, "SERVICE_UNAVAILABLE");
}
