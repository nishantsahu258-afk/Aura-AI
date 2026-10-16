import { useState, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, AlertTriangle, Square, RotateCcw, Pencil, Image as ImageIcon } from "lucide-react";
import Logo from "./Logo.jsx";
import { useApp } from "../context/AppContext.jsx";
import { getAttachmentUrl } from "../lib/api.js";

function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const displayLang = (language || "CODE").toUpperCase();

  return (
    <div
      className="my-3 overflow-hidden rounded-[var(--radius-md)] border text-left"
      style={{
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-border-subtle)",
      }}
    >
      <div
        className="flex items-center justify-between border-b px-3.5 py-1.5 text-xs"
        style={{
          backgroundColor: "var(--color-surface-hover)",
          borderColor: "var(--color-border-subtle)",
          color: "var(--color-foreground-muted)",
        }}
      >
        <span
          className="font-mono text-[11px] font-semibold tracking-wider"
          style={{ color: "var(--color-primary-light)" }}
        >
          {displayLang}
        </span>
        <button
          type="button"
          onClick={copyCode}
          className="flex items-center gap-1.5 rounded px-2 py-0.5 text-xs transition-colors hover:text-[var(--color-foreground)]"
          style={{ background: "transparent", border: "none", cursor: "pointer" }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className="overflow-x-auto p-3.5 text-sm leading-relaxed"
        style={{ margin: 0, background: "transparent" }}
      >
        <code
          className="font-mono"
          style={{
            color: "var(--color-foreground-secondary)",
            background: "transparent",
            padding: 0,
            border: "none",
          }}
        >
          {code}
        </code>
      </pre>
    </div>
  );
}

const MarkdownContent = memo(function MarkdownContent({ content, isStreaming }) {
  return (
    <div className="ai-message md-content leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children).replace(/\n$/, "");
            if (!inline && (match || codeString.includes("\n"))) {
              return <CodeBlock language={match ? match[1] : ""} code={codeString} />;
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && <span className="aura-streaming-cursor" aria-hidden="true" />}
    </div>
  );
});

export default function MessageBubble({ message, hasSubsequent = false }) {
  const { handleStop, regenerateInChat, editAndRegenerate, activeId, busy } = useApp();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content || "");
  const [editError, setEditError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isUser = message.role === "user";
  const isError = message.role === "error" || message.status === "error";
  const isThinking = message.status === "thinking" && !message.content;
  const isStreaming = message.status === "streaming";
  const isStopped = message.status === "stopped";
  const isComplete = message.status === "complete" || (!message.status && !isError && !isThinking && !isStreaming && !isStopped);

  const attachmentSrc = message.attachment ? getAttachmentUrl(message.attachment) : null;

  function handleCopy() {
    if (!message.content) return;
    navigator.clipboard?.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleRegenerate() {
    regenerateInChat(activeId);
  }

  function handleCancel() {
    setEditText(message.content || "");
    setEditError(null);
    setIsEditing(false);
  }

  async function handleSave() {
    const trimmed = editText.trim();
    if (!trimmed || busy || isSubmitting) return;

    setIsSubmitting(true);
    setEditError(null);
    try {
      setIsEditing(false);
      await editAndRegenerate(activeId, message.id, trimmed);
    } catch (err) {
      setIsEditing(true);
      setEditError(err.message || "Failed to save and regenerate. Original message preserved.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isUser) {
    if (isEditing) {
      const canSubmit = Boolean(editText.trim() && !busy && !isSubmitting);

      return (
        <div className="flex justify-end w-full">
          <div
            className="w-full max-w-[90%] sm:max-w-[80%] rounded-[var(--radius-xl)] p-3.5 shadow-md text-left"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-primary)",
              boxShadow: "0 0 0 1px var(--color-primary-soft), 0 4px 12px rgba(0,0,0,0.25)",
            }}
          >
            {/* Warning if subsequent messages exist */}
            {hasSubsequent && (
              <div
                className="mb-2.5 flex items-start gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-xs"
                style={{
                  background: "rgba(245, 158, 11, 0.12)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  color: "#fbbf24",
                }}
              >
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>
                  Editing this message will remove all subsequent responses and continue the conversation from here.
                </span>
              </div>
            )}

            {/* Attached image indicator in edit view */}
            {message.attachment && (
              <div
                className="mb-2.5 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1 text-xs"
                style={{
                  background: "var(--color-surface-hover)",
                  border: "1px solid var(--color-border-subtle)",
                  color: "var(--color-foreground-secondary)",
                }}
              >
                {attachmentSrc ? (
                  <img
                    src={attachmentSrc}
                    alt=""
                    className="h-4 w-4 rounded object-cover"
                  />
                ) : (
                  <ImageIcon size={13} className="shrink-0 text-violet-400" />
                )}
                <span className="font-medium truncate max-w-[200px]">
                  {message.attachment.name || "Attached image"}
                </span>
                {message.attachment.size && (
                  <span className="text-[11px] opacity-60">
                    ({message.attachment.size > 1024 * 1024
                      ? `${(message.attachment.size / (1024 * 1024)).toFixed(1)} MB`
                      : `${Math.round(message.attachment.size / 1024)} KB`})
                  </span>
                )}
              </div>
            )}

            <textarea
              value={editText}
              onChange={(e) => {
                setEditText(e.target.value);
                if (editError) setEditError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  handleCancel();
                } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  if (canSubmit) handleSave();
                }
              }}
              rows={Math.max(2, Math.min(8, (editText.match(/\n/g) || []).length + 2))}
              placeholder="Edit your message..."
              className="w-full resize-none rounded-[var(--radius-md)] p-2.5 text-sm leading-relaxed focus:outline-none"
              style={{
                background: "var(--color-surface-hover)",
                color: "var(--color-foreground)",
                border: "1px solid var(--color-border-subtle)",
              }}
              autoFocus
            />

            {editError && (
              <p className="mt-1.5 text-xs text-red-400">
                {editError}
              </p>
            )}

            <div className="mt-2.5 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="rounded-[var(--radius-sm)] px-3 py-1.5 font-medium transition-colors hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
                style={{
                  background: "transparent",
                  border: "1px solid var(--color-border-subtle)",
                  color: "var(--color-foreground-muted)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={!canSubmit}
                className="flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3.5 py-1.5 font-medium text-white transition-opacity hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: "var(--color-primary)",
                  border: "none",
                  cursor: canSubmit ? "pointer" : "not-allowed",
                }}
              >
                {isSubmitting ? (
                  <>
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  "Save & Regenerate"
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="group flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => {
            setEditText(message.content || "");
            setEditError(null);
            setIsEditing(true);
          }}
          disabled={busy}
          title="Edit message"
          aria-label="Edit message"
          className="opacity-70 sm:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity p-1.5 rounded-[var(--radius-xs)] text-muted hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] disabled:opacity-30 disabled:pointer-events-none"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--color-foreground-muted)",
          }}
        >
          <Pencil size={13} />
        </button>

        <div
          className="user-message max-w-[80%] rounded-[var(--radius-xl)] px-4 py-3 shadow-sm"
          style={{
            background: "var(--color-surface-hover)",
            border: "1px solid var(--color-border-subtle)",
            color: "var(--color-foreground)",
          }}
        >
          {message.attachment && (
            <div className="mb-2.5">
              {attachmentSrc && (
                <div className="mb-2 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] max-w-sm">
                  <img
                    src={attachmentSrc}
                    alt={message.attachment.name || "Attached image"}
                    className="max-h-60 w-auto object-cover rounded-[var(--radius-md)]"
                    loading="lazy"
                  />
                </div>
              )}
              <div
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1 text-xs"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border-subtle)",
                  color: "var(--color-foreground-secondary)",
                }}
              >
                <ImageIcon size={13} className="shrink-0 text-violet-400" />
                <span className="font-medium truncate max-w-[220px]">
                  {message.attachment.name || "Attached image"}
                </span>
                {message.attachment.size && (
                  <span className="text-[11px] opacity-60">
                    ({message.attachment.size > 1024 * 1024
                      ? `${(message.attachment.size / (1024 * 1024)).toFixed(1)} MB`
                      : `${Math.round(message.attachment.size / 1024)} KB`})
                  </span>
                )}
              </div>
            </div>
          )}

          <p
            className="whitespace-pre-wrap leading-relaxed break-words"
            style={{ fontSize: "var(--text-body)" }}
          >
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  const isGenerating = isThinking || isStreaming;

  return (
    <div className="group flex gap-3 text-left">
      {/* Aura Avatar */}
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
          isGenerating ? "aura-avatar-glow" : ""
        }`}
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border-subtle)",
        }}
      >
        <Logo size={16} animated={isGenerating} />
      </div>

      {/* Message Body & Header */}
      <div className="min-w-0 flex-1">
        {/* Header Indicator matching states in specification & reference UI */}
        <div className="mb-1.5 flex items-center gap-2">
          <span
            className="font-medium text-xs tracking-tight"
            style={{ color: "var(--color-foreground)" }}
          >
            Aura AI
          </span>

          {isThinking && (
            <span
              className="flex items-center gap-1.5 text-[11px]"
              style={{ color: "var(--color-violet-light)" }}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-violet)] animate-pulse" />
              Thinking...
            </span>
          )}

          {isStreaming && (
            <span
              className="flex items-center gap-1.5 text-[11px]"
              style={{ color: "var(--color-violet-light)" }}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-violet)] animate-ping" />
              Generating response...
            </span>
          )}

          {isStopped && (
            <span className="flex items-center gap-1.5 text-[11px] text-amber-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
              Stopped
            </span>
          )}

          {isComplete && message.content && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400">
              <Check size={11} />
              Response complete
            </span>
          )}

          {isError && (
            <span className="flex items-center gap-1 text-[11px] text-red-400">
              <AlertTriangle size={11} />
              Error
            </span>
          )}
        </div>

        {/* State A: Waiting / Thinking state */}
        {isThinking && (
          <div className="py-2">
            <div className="flex items-center gap-1.5 pb-2">
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-violet)] animate-bounce [animation-delay:-0.3s]" />
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-violet)] animate-bounce [animation-delay:-0.15s]" />
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-violet)] animate-bounce" />
            </div>
            <p
              className="text-xs"
              style={{ color: "var(--color-foreground-muted)" }}
            >
              Understanding your question...
            </p>
          </div>
        )}

        {/* State B, C, D, E: Streamed / Completed / Stopped Content */}
        {!isThinking && !isError && (
          <div>
            <MarkdownContent content={message.content || ""} isStreaming={isStreaming} />

            {/* State E: Subtle Stopped footer */}
            {isStopped && (
              <p
                className="mt-2 text-xs"
                style={{ color: "var(--color-foreground-muted)" }}
              >
                Generation stopped. You can continue or regenerate.
              </p>
            )}
          </div>
        )}

        {/* State F: Error state */}
        {isError && (
          <div
            className="flex items-start gap-2.5 rounded-[var(--radius-md)] px-3.5 py-3 my-1"
            style={{
              background: "var(--color-error-soft)",
              border: "1px solid rgb(239 68 68 / 0.25)",
            }}
          >
            <AlertTriangle
              size={16}
              style={{ color: "var(--color-error)", marginTop: 2, flexShrink: 0 }}
            />
            <div className="flex-1">
              <p
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-error)",
                  marginBottom: 8,
                }}
              >
                {message.content || "Something went wrong communicating with Aura. Please try again."}
              </p>
              <button
                type="button"
                onClick={handleRegenerate}
                className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{
                  background: "var(--color-error)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <RotateCcw size={12} />
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Action Row */}
        {!isThinking && !isError && (
          <div className="mt-2.5 flex items-center gap-3 text-xs">
            {isStreaming ? (
              // Stop action shown during generation
              <button
                type="button"
                onClick={() => handleStop()}
                className="flex items-center gap-1.5 rounded-[var(--radius-xs)] px-2 py-1 text-red-400 transition-colors hover:bg-red-500/10"
                style={{
                  background: "transparent",
                  border: "1px solid rgb(248 113 113 / 0.3)",
                  cursor: "pointer",
                }}
              >
                <Square size={11} fill="currentColor" />
                Stop
              </button>
            ) : (
              // Regenerate action
              <button
                type="button"
                onClick={handleRegenerate}
                className="flex items-center gap-1.5 rounded-[var(--radius-xs)] px-2 py-1 text-muted transition-colors hover:text-[var(--color-foreground)]"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-foreground-muted)",
                }}
              >
                <RotateCcw size={12} />
                Regenerate
              </button>
            )}

            {/* Copy button */}
            {message.content && (
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-[var(--radius-xs)] px-2 py-1 text-muted transition-colors hover:text-[var(--color-foreground)]"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-foreground-muted)",
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copied" : "Copy"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
