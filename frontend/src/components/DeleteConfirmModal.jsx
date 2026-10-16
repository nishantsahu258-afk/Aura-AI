import { X, AlertTriangle } from "lucide-react";

export default function DeleteConfirmModal({ onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      style={{ background: "rgb(0 0 0 / 0.65)", backdropFilter: "blur(4px)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="animate-scale-in w-full max-w-sm rounded-[var(--radius-2xl)] p-6"
        style={{
          background: "var(--color-background-elevated)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)]"
              style={{ background: "var(--color-error-soft)" }}
            >
              <AlertTriangle size={17} style={{ color: "var(--color-error)" }} />
            </div>
            <h5 style={{ margin: 0, color: "var(--color-foreground)" }}>Delete chat?</h5>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close modal"
            className="icon-btn rounded-[var(--radius-sm)] p-1.5"
            style={{ background: "transparent", color: "var(--color-foreground-muted)" }}
          >
            <X size={18} />
          </button>
        </div>

        <p
          className="mb-6"
          style={{
            fontSize: "var(--text-body-sm)",
            color: "var(--color-foreground-secondary)",
          }}
        >
          Are you sure you want to delete this chat? This action cannot be undone.
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-[var(--radius-md)] px-4 py-2 font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{
              background: "transparent",
              border: "1px solid var(--color-border)",
              color: "var(--color-foreground)",
              fontSize: "var(--text-body-sm)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-[var(--radius-md)] px-4 py-2 font-medium transition-opacity hover:opacity-90"
            style={{
              background: "var(--color-error)",
              color: "#ffffff",
              border: "none",
              fontSize: "var(--text-body-sm)",
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
