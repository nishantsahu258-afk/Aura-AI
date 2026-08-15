import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useChats } from "../hooks/useChats.js";
import { readString, writeString, STORAGE_KEYS } from "../lib/storage.js";
import { buildContents, AURA_SYSTEM_INSTRUCTION } from "../lib/prompt.js";
import { sendMessage, GeminiError, DEFAULT_MODEL, AVAILABLE_MODELS } from "../lib/gemini.js";

const AppContext = createContext(null);

/** Apply theme to <html> data-theme attribute */
function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
}

export function AppProvider({ children }) {
  const {
    chats,
    activeChat,
    activeId,
    createChat,
    deleteChat,
    selectChat,
    addMessage,
    updateMessage,
    removeMessage,
  } = useChats();

  const [apiKey, setApiKey] = useState(() => readString(STORAGE_KEYS.API_KEY, ""));
  const [model, setModel] = useState(() => {
    const saved = readString(STORAGE_KEYS.MODEL, DEFAULT_MODEL);
    return AVAILABLE_MODELS.some(m => m.id === saved) ? saved : DEFAULT_MODEL;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef(null);

  // -------------------------------------------------------
  // Theme
  // -------------------------------------------------------
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("aura-theme");
    const t = stored === "dark" || stored === "light" ? stored : "dark";
    applyTheme(t);
    return t;
  });

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      localStorage.setItem("aura-theme", next);
      return next;
    });
  }, []);

  // Keep <html> in sync if theme changes for any other reason
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function handleSaveSettings({ apiKey: key, model: m }) {
    setApiKey(key);
    setModel(m);
    writeString(STORAGE_KEYS.API_KEY, key);
    writeString(STORAGE_KEYS.MODEL, m);
  }

  /**
   * Sends a message in a given chat. Returns nothing; callers that need to
   * navigate (e.g. the landing page, which routes to /chat/:id right after
   * the first message) should do so themselves once this resolves/starts.
   */
  const sendInChat = useCallback(
    async (chatId, text, priorMessages) => {
      if (busy) return;

      if (!apiKey) {
        setSettingsOpen(true);
        return;
      }

      // priorMessages lets callers (e.g. startChat, right after creating a
      // brand-new chat) skip the state lookup entirely — avoids a race where
      // the freshly-created chat hasn't landed in `chats` yet.
      const history = priorMessages ?? chats.find((c) => c.id === chatId)?.messages ?? [];

      addMessage(chatId, "user", text);

      const contents = buildContents([...history, { role: "user", content: text }]);

      setBusy(true);
      const controller = new AbortController();
      abortRef.current = controller;

      const assistantMessageId = addMessage(chatId, "assistant", "");

      try {
        const reply = await sendMessage({
          apiKey,
          model,
          contents,
          systemInstruction: AURA_SYSTEM_INSTRUCTION,
          signal: controller.signal,
        });
        updateMessage(chatId, assistantMessageId, reply);
      } catch (err) {
        if (err.name === "AbortError") {
          removeMessage(chatId, assistantMessageId);
        } else {
          const message =
            err instanceof GeminiError ? err.message : "Something went wrong. Please try again.";
          removeMessage(chatId, assistantMessageId);
          addMessage(chatId, "error", message);
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [chats, apiKey, model, busy, addMessage, updateMessage, removeMessage]
  );

  /** Used from the landing hero: makes a fresh chat, fires the first turn. */
  const startChat = useCallback(
    (text) => {
      if (!apiKey) {
        setSettingsOpen(true);
        return null;
      }
      const id = createChat();
      // Fresh chat has no history yet — pass [] explicitly so the first
      // turn never depends on the new chat having landed in state.
      queueMicrotask(() => sendInChat(id, text, []));
      return id;
    },
    [apiKey, createChat, sendInChat]
  );

  function handleStop() {
    abortRef.current?.abort();
  }

  const changeModel = useCallback((newModel) => {
    setModel(newModel);
    writeString(STORAGE_KEYS.MODEL, newModel);
  }, []);

  const value = {
    chats,
    activeChat,
    activeId,
    createChat,
    deleteChat,
    selectChat,
    addMessage,
    removeMessage,
    apiKey,
    model,
    changeModel,
    settingsOpen,
    setSettingsOpen,
    handleSaveSettings,
    busy,
    sendInChat,
    startChat,
    handleStop,
    theme,
    toggleTheme,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
