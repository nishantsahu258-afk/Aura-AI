import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, AlertTriangle } from "lucide-react";
import Logo from "./Logo.jsx";

export default function MessageBubble({ message }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const isError = message.role === "error";

  function handleCopy() {
    navigator.clipboard?.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="user-message max-w-[75%] px-4 py-3"
          style={{ color: "var(--color-foreground)" }}
        >
          <p
            className="whitespace-pre-wrap"
            style={{ fontSize: "var(--text-body)", color: "var(--color-foreground)" }}
          >
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex gap-3">
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border-subtle)",
        }}
      >
        <Logo size={16} animated={false} />
      </div>

      <div className="min-w-0 flex-1">
        {isError ? (
          <div
            className="flex items-start gap-2 rounded-[var(--radius-md)] px-3.5 py-3"
            style={{
              background: "var(--color-error-soft)",
              border: "1px solid rgb(239 68 68 / 0.25)",
            }}
          >
            <AlertTriangle
              size={16}
              style={{ color: "var(--color-error)", marginTop: 2, flexShrink: 0 }}
            />
            <p
              style={{
                fontSize: "var(--text-body-sm)",
                color: "var(--color-error)",
              }}
            >
              {message.content}
            </p>
          </div>
        ) : (
          <div className="ai-message md-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}

        {!isError && message.content && (
          <button
            onClick={handleCopy}
            className="mt-1.5 flex items-center gap-1.5 rounded-[var(--radius-xs)] px-1.5 py-1 text-muted opacity-0 transition-opacity group-hover:opacity-100"
            style={{
              background: "transparent",
              border: "none",
              fontSize: "var(--text-caption)",
              color: "var(--color-foreground-muted)",
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
    </div>
  );
}
