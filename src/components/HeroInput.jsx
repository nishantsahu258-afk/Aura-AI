import { useEffect, useRef, useState } from "react";
import { ArrowUp, Plus, Mic } from "lucide-react";
import CustomSelect from "./CustomSelect.jsx";
import { useApp } from "../context/AppContext.jsx";
import { AVAILABLE_MODELS } from "../lib/gemini.js";

export default function HeroInput({ onSend, disabled }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef(null);
  const { model, changeModel } = useApp();

  const selectedModel = AVAILABLE_MODELS.find((m) => m.id === model) || AVAILABLE_MODELS[0];
  const shortLabel = selectedModel.label.split(" ").slice(0, 2).join(" ");

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div
      className="hero-input-card mx-auto w-full"
      style={{ maxWidth: "var(--container-chat)" }}
    >
      {/* Text area */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask Aura to help you build, plan, or figure something out…"
        rows={2}
        autoFocus
        className="w-full resize-none bg-transparent"
        style={{
          background: "transparent",
          border: "none",
          outline: "none",
          boxShadow: "none",
          fontSize: "1.0625rem",
          color: "var(--color-foreground)",
          lineHeight: 1.6,
          minHeight: "3.5rem",
          maxHeight: "12rem",
          padding: "1.25rem 1.5rem 0.5rem",
          overflowY: "auto",
          wordBreak: "break-word",
          overflowWrap: "break-word",
        }}
      />

      {/* Bottom toolbar */}
      <div className="flex items-center justify-between px-3 pb-3 pt-1">
        {/* Left — Plus + Model selector */}
        <div className="flex items-center gap-2">
          <button
            id="hero-input-attach-btn"
            type="button"
            title="Attachments — coming soon"
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{
              background: "var(--color-surface-hover)",
              border: "1px solid var(--color-border)",
            }}
          >
            <Plus size={17} style={{ color: "var(--color-foreground-muted)" }} />
          </button>

          {/* Compact model pill */}
          <CustomSelect
            options={AVAILABLE_MODELS}
            value={model}
            onChange={changeModel}
            compact
            shortLabel={shortLabel}
          />
        </div>

        {/* Right — Mic + Send */}
        <div className="flex items-center gap-2">
          <button
            id="hero-input-mic-btn"
            type="button"
            title="Voice input — coming soon"
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: "transparent", border: "none" }}
          >
            <Mic size={18} style={{ color: "var(--color-foreground-muted)" }} />
          </button>

          <button
            id="hero-input-send-btn"
            onClick={submit}
            disabled={!value.trim() || disabled}
            aria-label="Send message"
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{
              background: value.trim()
                ? "linear-gradient(135deg, #5b8cff 0%, #7657e8 45%, #ee79c0 100%)"
                : "var(--color-surface-active)",
              color: "#ffffff",
              border: "none",
              outline: "none",
              opacity: value.trim() && !disabled ? 1 : 0.45,
              transition: "opacity 150ms ease, transform 150ms ease, background 200ms ease",
              transform: value.trim() ? "scale(1)" : "scale(0.9)",
            }}
          >
            <ArrowUp size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}

