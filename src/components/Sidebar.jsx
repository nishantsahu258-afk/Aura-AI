import { PenSquare, Trash2, Settings, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState } from "react";
import Logo from "./Logo.jsx";
import DeleteConfirmModal from "./DeleteConfirmModal.jsx";

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return "now";
  if (diff < hr) return `${Math.floor(diff / min)}m`;
  if (diff < day) return `${Math.floor(diff / hr)}h`;
  return `${Math.floor(diff / day)}d`;
}

const sidebarStyle = {
  background: "var(--color-background-soft)",
  borderRight: "1px solid var(--color-border-subtle)",
  transition: "background 280ms ease",
};

export default function Sidebar({
  chats,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  onOpenSettings,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}) {
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  if (collapsed) {
    return (
      <div
        className="hidden md:flex h-full w-16 flex-col items-center gap-4 py-4"
        style={sidebarStyle}
      >
        <Logo size={28} />
        <button
          id="sidebar-expand-btn"
          aria-label="Expand sidebar"
          onClick={onToggleCollapsed}
          className="icon-btn rounded-[var(--radius-sm)] p-2"
          style={{ background: "transparent", color: "var(--color-foreground-muted)" }}
        >
          <PanelLeftOpen size={18} />
        </button>
        <button
          id="sidebar-new-chat-collapsed-btn"
          aria-label="New chat"
          onClick={onCreate}
          className="icon-btn rounded-[var(--radius-sm)] p-2"
          style={{ background: "transparent", color: "var(--color-foreground-muted)" }}
        >
          <PenSquare size={18} />
        </button>
        <div className="mt-auto">
          <button
            id="sidebar-settings-collapsed-btn"
            aria-label="Settings"
            onClick={onOpenSettings}
            className="icon-btn rounded-[var(--radius-sm)] p-2"
            style={{ background: "transparent", color: "var(--color-foreground-muted)" }}
          >
            <Settings size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Overlay Background */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/40 md:hidden" 
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-72 shrink-0 flex-col md:relative md:translate-x-0 transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={sidebarStyle}
      >
        <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2.5">
          <Logo size={26} />
          <span
            style={{
              fontSize: "1.05rem",
              fontWeight: 650,
              color: "var(--color-foreground)",
            }}
          >
            Aura
          </span>
        </div>
        <button
          id="sidebar-collapse-btn"
          aria-label="Collapse sidebar"
          onClick={onToggleCollapsed}
          className="icon-btn hidden md:block rounded-[var(--radius-sm)] p-1.5"
          style={{ background: "transparent", color: "var(--color-foreground-muted)" }}
        >
          <PanelLeftClose size={17} />
        </button>
      </div>

      <div className="px-4 pt-4">
        <button
          id="sidebar-new-chat-btn"
          onClick={() => {
            onCreate();
            if (onCloseMobile) onCloseMobile();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-pill)] py-2.5 font-semibold"
          style={{
            background: "var(--brand-gradient)",
            color: "var(--color-on-brand)",
            fontSize: "var(--text-body-sm)",
            border: "none",
          }}
        >
          <PenSquare size={16} />
          New chat
        </button>
      </div>

      <nav className="hide-scrollbar mt-4 flex-1 space-y-1 overflow-y-auto px-2.5 pb-3">
        {chats.map((chat) => {
          const isActive = chat.id === activeId;
          return (
            <div
              key={chat.id}
              onClick={() => {
                onSelect(chat.id);
                if (onCloseMobile) onCloseMobile();
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onSelect(chat.id);
                  if (onCloseMobile) onCloseMobile();
                }
              }}
              className="group flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] px-3 py-2.5"
              style={{
                background: isActive ? "var(--color-surface-active)" : "transparent",
                border: isActive
                  ? "1px solid var(--color-border)"
                  : "1px solid transparent",
                transition: "background 120ms ease, border-color 120ms ease",
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = "var(--color-surface-hover)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
            >
              <div className="min-w-0 flex-1">
                <p
                  className="truncate"
                  style={{
                    fontSize: "var(--text-body-sm)",
                    color: isActive
                      ? "var(--color-foreground)"
                      : "var(--color-foreground-secondary)",
                  }}
                >
                  {chat.title}
                </p>
              </div>
              <span
                className="shrink-0 text-muted"
                style={{ fontSize: "var(--text-caption)" }}
              >
                {timeAgo(chat.updatedAt)}
              </span>
              <button
                aria-label="Delete chat"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirmId(chat.id);
                }}
                className="shrink-0 rounded-[var(--radius-xs)] p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--color-foreground-subtle)",
                  transition: "opacity 150ms ease",
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </nav>

      <div
        className="border-t px-3 py-3"
        style={{ borderColor: "var(--color-border-subtle)" }}
      >
        <button
          id="sidebar-settings-btn"
          onClick={() => {
            onOpenSettings();
            if (onCloseMobile) onCloseMobile();
          }}
          className="icon-btn flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2"
          style={{
            background: "transparent",
            border: "none",
            fontSize: "var(--text-body-sm)",
            color: "var(--color-foreground-secondary)",
          }}
        >
          <Settings size={16} />
          Settings
        </button>
      </div>

      {deleteConfirmId && (
        <DeleteConfirmModal
          onCancel={() => setDeleteConfirmId(null)}
          onConfirm={() => {
            onDelete(deleteConfirmId);
            setDeleteConfirmId(null);
          }}
        />
      )}
      </aside>
    </>
  );
}
