import { useEffect, useRef, useState } from "react";
import { ArrowUp, Plus, Mic, X } from "lucide-react";
import CustomSelect from "./CustomSelect.jsx";
import { useApp } from "../context/AppContext.jsx";
import { AVAILABLE_MODELS } from "../lib/gemini.js";

export default function HeroInput({ onSend, disabled }) {
  const [value, setValue] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [attachError, setAttachError] = useState(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const { model, changeModel } = useApp();

  const selectedModel = AVAILABLE_MODELS.find((m) => m.id === model) || AVAILABLE_MODELS[0];
  const shortLabel = selectedModel.label.split(" ").slice(0, 2).join(" ");

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setAttachError(null);
    const validTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setAttachError("Only PNG, JPEG, and WebP images are supported.");
      setTimeout(() => setAttachError(null), 4000);
      return;
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setAttachError("Image size must be less than 5MB.");
      setTimeout(() => setAttachError(null), 4000);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = typeof result === "string" ? result.split(",")[1] : "";
      setAttachment({
        name: file.name,
        type: file.type,
        size: file.size,
        previewUrl: result,
        data: base64,
      });
    };
    reader.readAsDataURL(file);
  }

  function removeAttachment() {
    setAttachment(null);
    setAttachError(null);
  }

  function submit() {
    const trimmed = value.trim();
    if ((!trimmed && !attachment) || disabled) return;
    onSend(trimmed, attachment);
    setValue("");
    setAttachment(null);
    setAttachError(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const canSend = Boolean((value.trim() || attachment) && !disabled);

  return (
    <div
      className="hero-input-card mx-auto w-full"
      style={{ maxWidth: "var(--container-chat)" }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />

      {/* Attachment preview */}
      {attachment && (
        <div className="flex items-center gap-3 px-4 pt-3.5 pb-2 border-b border-[var(--color-border-subtle)] animate-fade-in">
          <div className="relative group">
            <img
              src={attachment.previewUrl}
              alt={attachment.name}
              className="h-14 w-14 rounded-[var(--radius-md)] object-cover border border-[var(--color-border-subtle)] shadow-sm"
            />
            <button
              type="button"
              onClick={removeAttachment}
              title="Remove attachment"
              aria-label="Remove attachment"
              className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900/90 text-white hover:bg-red-500 transition-colors shadow"
              style={{ border: "1px solid rgba(255,255,255,0.25)", cursor: "pointer" }}
            >
              <X size={11} />
            </button>
          </div>
          <div className="flex flex-col min-w-0 text-left">
            <span className="text-xs font-medium truncate max-w-[200px]" style={{ color: "var(--color-foreground)" }}>
              {attachment.name}
            </span>
            <span className="text-[11px]" style={{ color: "var(--color-foreground-muted)" }}>
              {attachment.size > 1024 * 1024
                ? `${(attachment.size / (1024 * 1024)).toFixed(1)} MB`
                : `${Math.round(attachment.size / 1024)} KB`} • Image ready to send
            </span>
          </div>
        </div>
      )}

      {attachError && (
        <div className="px-4 pt-2 text-xs text-red-400 text-left">
          {attachError}
        </div>
      )}

      {/* Text area */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={attachment ? "Ask something about this image…" : "Ask Aura to help you build, plan, or figure something out…"}
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
            onClick={() => fileInputRef.current?.click()}
            title="Attach image (PNG, JPEG, WebP)"
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-surface-active)]"
            style={{
              background: attachment ? "var(--color-surface-active)" : "var(--color-surface-hover)",
              border: "1px solid var(--color-border)",
              cursor: "pointer",
            }}
          >
            <Plus size={17} style={{ color: attachment ? "var(--color-primary-light)" : "var(--color-foreground-muted)" }} />
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
            disabled={!canSend}
            aria-label="Send message"
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{
              background: canSend
                ? "linear-gradient(135deg, #5b8cff 0%, #7657e8 45%, #ee79c0 100%)"
                : "var(--color-surface-active)",
              color: canSend ? "#ffffff" : "var(--color-foreground-muted)",
              border: "none",
              outline: "none",
              opacity: canSend ? 1 : 0.45,
              transition: "opacity 150ms ease, transform 150ms ease, background 200ms ease",
              transform: canSend ? "scale(1)" : "scale(0.9)",
              cursor: canSend ? "pointer" : "not-allowed",
            }}
          >
            <ArrowUp size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}

