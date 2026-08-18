import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Menu, Sun, Moon } from "lucide-react";
import Sidebar from "../components/Sidebar.jsx";
import ChatWindow from "../components/ChatWindow.jsx";
import { useApp } from "../context/AppContext.jsx";

export default function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const {
    chats,
    deleteChat,
    sendInChat,
    busy,
    handleStop,
    setSettingsOpen,
    theme,
    toggleTheme,
  } = useApp();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const chat = chats.find((c) => c.id === chatId) ?? null;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 260);
    return () => clearTimeout(t);
  }, [chatId]);

  useEffect(() => {
    if (!loading && !chat) {
      navigate("/", { replace: true });
    }
  }, [loading, chat, navigate]);

  function handleSelect(id) {
    navigate(`/chat/${id}`);
  }

  function handleDelete(id) {
    deleteChat(id);
    if (id === chatId) navigate("/", { replace: true });
  }

  return (
    <div
      className="page-transition flex h-screen w-screen overflow-hidden"
      style={{ background: "var(--background)", transition: "background 280ms ease" }}
    >
      <Sidebar
        chats={chats}
        activeId={chatId}
        onSelect={handleSelect}
        onCreate={() => navigate("/")}
        onDelete={handleDelete}
        onOpenSettings={() => setSettingsOpen(true)}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header
          className="flex h-14 shrink-0 items-center gap-3 px-4"
          style={{ borderBottom: "1px solid var(--color-border-subtle)", background: "var(--background)" }}
        >
          <button
            id="chat-open-sidebar-btn"
            aria-label="Open sidebar"
            onClick={() => {
              setSidebarCollapsed(false);
              setMobileMenuOpen(true);
            }}
            className={`icon-btn rounded-lg p-1.5 ${!sidebarCollapsed ? "md:hidden" : ""}`}
            style={{ background: "transparent", color: "var(--color-foreground-muted)" }}
          >
            <Menu size={18} />
          </button>
          <span
            className="text-muted flex-1 truncate font-medium"
            style={{ fontSize: "var(--text-body)", marginLeft: "4px" }}
          >
            {chat?.title ?? ""}
          </span>

          {/* Theme toggle */}
          <button
            id="chat-theme-toggle-btn"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            onClick={toggleTheme}
            className="theme-toggle"
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </header>

        <ChatWindow
          chat={chat}
          busy={busy}
          loading={loading}
          onSend={(text) => sendInChat(chatId, text)}
          onStop={handleStop}
        />
      </div>
    </div>
  );
}
