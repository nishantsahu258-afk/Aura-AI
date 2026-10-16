import { useState, useRef, useEffect } from "react";
import { Download, FileCode, FileText, Check } from "lucide-react";
import { exportChat } from "../lib/exportChat.js";

export default function ExportMenu({ chat }) {
  const [isOpen, setIsOpen] = useState(false);
  const [exportedFormat, setExportedFormat] = useState(null);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  const messageCount = Array.isArray(chat?.messages) ? chat.messages.length : 0;

  // Close on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleMouseDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleTriggerExport(format) {
    if (!chat) return;

    const success = exportChat(chat, format);
    if (success) {
      setExportedFormat(format);
      setTimeout(() => {
        setExportedFormat(null);
        setIsOpen(false);
      }, 700);
    }
  }

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        id="chat-export-btn"
        type="button"
        aria-label="Export chat conversation"
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Export conversation (.md, .txt)"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150 cursor-pointer"
        style={{
          border: "1px solid var(--color-border-subtle)",
          background: isOpen ? "var(--color-surface-hover)" : "var(--color-surface)",
          color: isOpen ? "var(--color-foreground)" : "var(--color-foreground-secondary)",
        }}
      >
        <Download size={15} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="chat-export-btn"
          className="absolute right-0 top-full mt-2 w-60 origin-top-right rounded-[var(--radius-md)] p-1.5 shadow-2xl z-50 animate-fade-in"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            boxShadow: "0 12px 30px -4px rgba(0, 0, 0, 0.35), 0 4px 12px -2px rgba(0, 0, 0, 0.2)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[var(--color-border-subtle)] mb-1">
            <span
              className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted"
              style={{ color: "var(--color-foreground-muted)" }}
            >
              Export Chat
            </span>
            <span
              className="text-[10px] font-medium rounded px-1.5 py-0.5"
              style={{
                background: "var(--color-surface-hover)",
                color: "var(--color-foreground-muted)",
              }}
            >
              {messageCount === 0 ? "Empty chat" : `${messageCount} message${messageCount === 1 ? "" : "s"}`}
            </span>
          </div>

          {/* Option: Markdown */}
          <button
            type="button"
            role="menuitem"
            id="export-markdown-option"
            onClick={() => handleTriggerExport("markdown")}
            className="flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-2.5 py-2 text-left transition-colors cursor-pointer hover:bg-[var(--color-surface-hover)]"
            style={{
              background: "transparent",
              border: "none",
            }}
          >
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)]"
              style={{ background: "rgba(118, 87, 232, 0.12)", color: "#9d86f7" }}
            >
              {exportedFormat === "markdown" ? (
                <Check size={14} className="text-emerald-400" />
              ) : (
                <FileCode size={14} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="text-xs font-medium truncate"
                style={{ color: "var(--color-foreground)" }}
              >
                Markdown (.md)
              </div>
              <div
                className="text-[11px] truncate opacity-70"
                style={{ color: "var(--color-foreground-muted)" }}
              >
                Structured headings & code blocks
              </div>
            </div>
          </button>

          {/* Option: Plain Text */}
          <button
            type="button"
            role="menuitem"
            id="export-text-option"
            onClick={() => handleTriggerExport("text")}
            className="flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-2.5 py-2 text-left transition-colors cursor-pointer hover:bg-[var(--color-surface-hover)]"
            style={{
              background: "transparent",
              border: "none",
            }}
          >
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)]"
              style={{ background: "rgba(16, 185, 129, 0.12)", color: "#34d399" }}
            >
              {exportedFormat === "text" ? (
                <Check size={14} className="text-emerald-400" />
              ) : (
                <FileText size={14} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="text-xs font-medium truncate"
                style={{ color: "var(--color-foreground)" }}
              >
                Plain Text (.txt)
              </div>
              <div
                className="text-[11px] truncate opacity-70"
                style={{ color: "var(--color-foreground-muted)" }}
              >
                Clean readable text transcript
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
