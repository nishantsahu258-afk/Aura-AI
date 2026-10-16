import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Menu, Sun, Moon } from "lucide-react";
import Sidebar from "../components/Sidebar.jsx";
import ChatWindow from "../components/ChatWindow.jsx";
import ExportMenu from "../components/ExportMenu.jsx";
import { useApp } from "../context/AppContext.jsx";

export default function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const {
    chats,
    loaded,
    createChat,
    deleteChat,
    selectChat,
    ensureMessagesLoaded,
    sendInChat,
    busy,
    handleStop,
    setSettingsOpen,
    theme,
    toggleTheme,
  } = useApp();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const chat = chats.find((c) => c.id === chatId) ?? null;

  useEffect(() => {
    if (chatId) {
      selectChat(chatId);
      if (ensureMessagesLoaded) {
        ensureMessagesLoaded(chatId);
      }
    }
  }, [chatId, selectChat, ensureMessagesLoaded]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSwitching(true);
    const t = setTimeout(() => setSwitching(false), 200);
    return () => clearTimeout(t);
  }, [chatId]);

  const showSkeleton =
    (!chat || !chat.messagesLoaded || switching) && (!chat?.messages || chat.messages.length === 0);

  useEffect(() => {
    if (!switching && loaded && !chat) {
      if (chats.length > 0) {
        navigate(`/chat/${chats[0].id}`, { replace: true });
      } else {
        const newId = createChat();
        navigate(`/chat/${newId}`, { replace: true });
      }
    }
  }, [switching, loaded, chat, chats, createChat, navigate]);

  function handleSelect(id) {
    navigate(`/chat/${id}`);
  }

  function handleCreate() {
    const newId = createChat();
    navigate(`/chat/${newId}`);
  }

  function handleDelete(id) {
    if (id === chatId) {
      const remaining = chats.filter((c) => c.id !== id);
      if (remaining.length > 0) {
        navigate(`/chat/${remaining[0].id}`, { replace: true });
      } else {
        const newId = createChat();
        navigate(`/chat/${newId}`, { replace: true });
      }
    }
    deleteChat(id);
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
        onCreate={handleCreate}
        onHome={() => navigate("/")}
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

          {/* Export conversation */}
          <ExportMenu chat={chat} />

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
          loading={showSkeleton}
          onSend={(text, image) => sendInChat(chatId, text, image)}
          onStop={handleStop}
        />
      </div>
    </div>
  );
}
