import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square, Plus, Mic, X } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";
import { AVAILABLE_MODELS } from "../lib/gemini.js";
import CustomSelect from "./CustomSelect.jsx";

const MAX_HEIGHT = 200; // px — grows to this then scrolls

export default function ChatInput({ onSend, onStop, disabled, busy }) {
  const [value, setValue] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [attachError, setAttachError] = useState(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
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

    const maxBytes = 5 * 1024 * 1024; // 5MB
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

  const canSend = Boolean((value.trim() || attachment) && !disabled);

  return (
    <div className="mx-auto w-full" style={{ maxWidth: "var(--container-chat)" }}>
      <div
        className="chat-input"
        style={{ borderRadius: "var(--radius-2xl)", padding: "0" }}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />

        {/* Attachment preview */}
        {attachment && (
          <div className="flex items-center gap-3 px-3.5 pt-3 pb-1 border-b border-[var(--color-border-subtle)] animate-fade-in">
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

        {/* Attachment error message if user selected unsupported file */}
        {attachError && (
          <div className="px-3.5 pt-2 text-xs text-red-400 text-left">
            {attachError}
          </div>
        )}

        {/* ── Responsive Layout: Stacked on mobile, inline on desktop ── */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-0 px-2 py-2">
          
          {/* Desktop Left: Plus button */}
          <button
            id="chat-input-attach-btn-desktop"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach image (PNG, JPEG, WebP)"
            className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-surface-hover)]"
            style={{ background: "transparent", border: "none", flexShrink: 0, cursor: "pointer" }}
          >
            <Plus size={17} style={{ color: attachment ? "var(--color-primary-light)" : "var(--color-foreground-muted)" }} />
          </button>

          {/* Middle: Textarea — grows to 200px then scrolls */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={attachment ? "Ask something about this image…" : "Ask Aura…"}
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
              onClick={() => fileInputRef.current?.click()}
              title="Attach image (PNG, JPEG, WebP)"
              className="flex sm:hidden h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{
                background: attachment ? "var(--color-surface-active)" : "var(--color-surface-hover)",
                border: "1px solid var(--color-border)",
                flexShrink: 0,
                cursor: "pointer",
              }}
            >
              <Plus size={17} style={{ color: attachment ? "var(--color-primary-light)" : "var(--color-foreground-muted)" }} />
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
                  type="button"
                  onClick={onStop}
                  aria-label="Stop generating"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
                  style={{
                    background: "linear-gradient(135deg, #7657e8 0%, #a82c91 100%)",
                    color: "#ffffff",
                    border: "none",
                    boxShadow: "0 0 16px rgba(118, 87, 232, 0.45)",
                    flexShrink: 0,
                    cursor: "pointer",
                  }}
                >
                  <Square size={13} fill="currentColor" />
                </button>
              ) : (
                <button
                  id="chat-input-send-btn"
                  onClick={submit}
                  disabled={!canSend}
                  aria-label="Send message"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: canSend
                      ? "linear-gradient(135deg, #5b8cff 0%, #7657e8 45%, #ee79c0 100%)"
                      : "var(--color-surface-active)",
                    color: canSend ? "#ffffff" : "var(--color-foreground-muted)",
                    border: "none",
                    outline: "none",
                    opacity: canSend ? 1 : 0.45,
                    transition: "opacity 150ms ease, transform 150ms ease",
                    transform: canSend ? "scale(1)" : "scale(0.92)",
                    flexShrink: 0,
                    cursor: canSend ? "pointer" : "not-allowed",
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

