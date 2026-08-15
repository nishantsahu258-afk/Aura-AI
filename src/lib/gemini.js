// Thin client around Google's Generative Language API.
// Deliberately dependency-free (plain fetch) so the project stays light.

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// How long to wait (ms) before we give up on a single fetch attempt
const FETCH_TIMEOUT_MS = 30_000;

export class GeminiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
  }
}

/** Wrap fetch with an explicit timeout so hung connections don't block forever */
async function fetchWithTimeout(url, options, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Combine caller's signal with our timeout signal
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

/**
 * Returns true for errors that are worth retrying:
 * - Network drops / stream resets (wsarecv, ECONNRESET, ERR_NETWORK_CHANGED…)
 * - Timeouts
 */
function isRetryableNetworkError(err) {
  if (err.name === "AbortError") return false; // user abort — don't retry
  const msg = (err.message || "").toLowerCase();
  return (
    err instanceof TypeError ||           // fetch network error
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

/**
 * Send formatted contents to Gemini and return the reply text.
 *
 * @param {Object} params
 * @param {string} params.apiKey
 * @param {string} params.model  - e.g. "gemini-2.0-flash"
 * @param {Array}  params.contents
 * @param {string} [params.systemInstruction]
 * @param {AbortSignal} [params.signal]
 */
export async function sendMessage({
  apiKey,
  model,
  contents,
  systemInstruction,
  signal,
}) {
  if (!apiKey) {
    throw new GeminiError(
      "No Gemini API key set. Add one in Settings to start chatting.",
      401
    );
  }

  // Fallback chain — tries primary model first, then alternates
  const modelsToTry = [
    ...new Set([
      model,
      "gemini-3.7-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
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
  let lastErrorMsg = "API is currently experiencing high demand. Please try again in a moment.";

  for (const currentModel of modelsToTry) {
    const url = `${BASE_URL}/${currentModel}:generateContent?key=${encodeURIComponent(apiKey)}`;

    // Retry loop: up to 3 attempts per model for transient errors
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
        // User pressed Stop — propagate immediately
        if (err.name === "AbortError" && signal?.aborted) throw err;

        if (isRetryableNetworkError(err) && attempt < 3) {
          // Exponential backoff: 1s, 2s
          await new Promise((r) => setTimeout(r, attempt * 1000));
          continue;
        }

        // Timeout on final attempt — move to next model
        lastErrorMsg = "Connection to Gemini timed out. Trying next available model…";
        break;
      }

      // ── Parse response ──────────────────────────────────────
      let data = null;
      try {
        data = await response.json();
      } catch (_) {
        // Malformed JSON — likely a stream truncation
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        lastErrorMsg = "Received an incomplete response. Please try again.";
        break;
      }

      if (!response.ok) {
        const apiMessage = data?.error?.message || "";

        if (response.status === 503 || response.status === 429) {
          lastErrorMsg =
            "This model is under high demand. Switching to a backup model…";
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 1500 * attempt));
            continue;
          }
          break; // exhausted retries — try next model
        }

        if (response.status === 404) {
          // Model doesn't exist or is deprecated — try next
          lastErrorMsg = apiMessage || `Model unavailable (${response.status})`;
          break;
        }

        if (response.status === 400) {
           // Bad request (prompt too long, etc) - DO NOT FALLBACK, throw immediately to show user
           throw new GeminiError(
             apiMessage || "Bad Request. Please check your prompt and try again.",
             400
           );
        }

        if (response.status === 401 || response.status === 403) {
          throw new GeminiError(
            "Invalid or unauthorised API key. Please check Settings.",
            response.status
          );
        }

        throw new GeminiError(
          apiMessage || `Gemini returned an error (${response.status}).`,
          response.status
        );
      }

      // ── Extract text ─────────────────────────────────────────
      const candidate = data?.candidates?.[0];
      const text =
        candidate?.content?.parts?.map((p) => p.text || "").join("") ?? "";

      if (!text) {
        const blockReason = data?.promptFeedback?.blockReason;
        if (blockReason) {
          throw new GeminiError(
            `Gemini declined to answer (${blockReason.toLowerCase()}).`,
            400
          );
        }
        // Empty but no block reason — retry once
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        throw new GeminiError("Gemini returned an empty response.", 500);
      }

      return text; // ✅ success
    }
  }

  throw new GeminiError(lastErrorMsg, 503);
}

export const AVAILABLE_MODELS = [
  { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash (Recommended flagship)" },
  { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite" },
];

export const DEFAULT_MODEL = "gemini-3.7-flash";

