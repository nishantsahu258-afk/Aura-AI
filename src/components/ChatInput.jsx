import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square, Plus, Mic } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";
import { AVAILABLE_MODELS } from "../lib/gemini.js";
import CustomSelect from "./CustomSelect.jsx";

const MAX_HEIGHT = 200; // px — grows to this then scrolls

export default function ChatInput({ onSend, onStop, disabled, busy }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef(null);
  const { model, changeModel } = useApp();

  const selectedModel = AVAILABLE_MODELS.find((m) => m.id === model) || AVAILABLE_MODELS[0];
  // Short label: take first two words e.g. "Gemini 3.7"
  const shortLabel = selectedModel.label.split(" ").slice(0, 2).join(" ");

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const newH = Math.min(el.scrollHeight, MAX_HEIGHT);
    el.style.height = newH + "px";
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, [value]);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.overflowY = "hidden";
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="mx-auto w-full" style={{ maxWidth: "var(--container-chat)" }}>
      <div
        className="chat-input"
        style={{ borderRadius: "var(--radius-2xl)", padding: "0" }}
      >
        {/* ── Responsive Layout: Stacked on mobile, inline on desktop ── */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-0 px-2 py-2">
          
          {/* Desktop Left: Plus button */}
          <button
            id="chat-input-attach-btn-desktop"
            type="button"
            title="Attach — coming soon"
            className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: "transparent", border: "none", flexShrink: 0 }}
          >
            <Plus size={17} style={{ color: "var(--color-foreground-muted)" }} />
          </button>

          {/* Middle: Textarea — grows to 200px then scrolls */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Aura…"
            rows={1}
            className="w-full sm:flex-1 resize-none bg-transparent"
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              boxShadow: "none",
              fontSize: "var(--text-body)",
              color: "var(--color-foreground)",
              lineHeight: "1.6",
              padding: "0.4rem 0.5rem",
              minHeight: "2.25rem",
              overflowY: "hidden",
              wordBreak: "break-word",
              overflowWrap: "break-word",
            }}
          />

          {/* Bottom on mobile / Right on desktop */}
          <div className="flex items-center justify-between sm:justify-end gap-1 w-full sm:w-auto sm:pl-1">
            
            {/* Mobile Left: Plus button */}
            <button
              id="chat-input-attach-btn-mobile"
              type="button"
              title="Attach — coming soon"
              className="flex sm:hidden h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: "var(--color-surface-hover)", border: "1px solid var(--color-border)", flexShrink: 0 }}
            >
              <Plus size={17} style={{ color: "var(--color-foreground-muted)" }} />
            </button>

            {/* Right side controls: Model, Mic, Send */}
            <div className="flex items-center gap-1">
              {/* Inline model switcher */}
              <div style={{ position: "relative" }}>
                <CustomSelect
                  options={AVAILABLE_MODELS}
                  value={model}
                  onChange={changeModel}
                  compact
                  shortLabel={shortLabel}
                />
              </div>

              {/* Mic */}
              <button
                id="chat-input-mic-btn"
                type="button"
                title="Voice — coming soon"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ background: "transparent", border: "none" }}
              >
                <Mic size={17} style={{ color: "var(--color-foreground-muted)" }} />
              </button>

              {/* Send / Stop */}
              {busy ? (
                <button
                  id="chat-input-stop-btn"
                  onClick={onStop}
                  aria-label="Stop generating"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: "var(--color-surface-active)",
                    border: "1px solid var(--color-border)",
                    flexShrink: 0,
                  }}
                >
                  <Square size={14} fill="currentColor" />
                </button>
              ) : (
                <button
                  id="chat-input-send-btn"
                  onClick={submit}
                  disabled={!value.trim() || disabled}
                  aria-label="Send message"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: value.trim()
                      ? "linear-gradient(135deg, #5b8cff 0%, #7657e8 45%, #ee79c0 100%)"
                      : "var(--color-surface-active)",
                    color: value.trim() ? "#ffffff" : "var(--color-foreground-muted)",
                    border: "none",
                    outline: "none",
                    opacity: value.trim() && !disabled ? 1 : 0.45,
                    transition: "opacity 150ms ease, transform 150ms ease",
                    transform: value.trim() ? "scale(1)" : "scale(0.92)",
                    flexShrink: 0,
                  }}
                >
                  <ArrowUp size={17} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <p
        className="mt-2 text-center"
        style={{ fontSize: "var(--text-caption)", color: "var(--color-foreground-subtle)" }}
      >
        Aura can make mistakes. Check important information.
      </p>
    </div>
  );
}

