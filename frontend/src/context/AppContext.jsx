import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useChats } from "../hooks/useChats.js";
import { readString, writeString, STORAGE_KEYS } from "../lib/storage.js";
import { DEFAULT_MODEL, AVAILABLE_MODELS } from "../lib/gemini.js";
import { api } from "../lib/api.js";

const AppContext = createContext(null);

function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
}

export function AppProvider({ children }) {
  const {
    chats,
    activeChat,
    activeId,
    loaded,
    createChat,
    deleteChat,
    renameChat,
    selectChat,
    ensureMessagesLoaded,
    addMessage,
    appendMessageChunk,
    finishMessage,
    setMessageStatus,
    removeMessage,
    truncateAndEditUserMessage,
    restoreChatState,
  } = useChats();

  const [model, setModel] = useState(() => {
    const saved = readString(STORAGE_KEYS.MODEL, DEFAULT_MODEL);
    return AVAILABLE_MODELS.some((m) => m.id === saved) ? saved : DEFAULT_MODEL;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [streamingChatId, setStreamingChatId] = useState(null);
  const abortControllersRef = useRef(new Map());

  // Derived busy state: current chat is busy if it is the one currently streaming
  const busy = Boolean(streamingChatId && streamingChatId === activeId);

  // Theme
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

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function handleSaveSettings({ model: m }) {
    if (m) {
      setModel(m);
      writeString(STORAGE_KEYS.MODEL, m);
    }
  }

  /**
   * Sends a message in a given chat via the real-time SSE streaming backend API.
   * Optimistically renders user message, sets thinking state, and streams deltas.
   */
  const sendInChat = useCallback(
    async (chatId, text, imageAttachment = null) => {
      if (abortControllersRef.current.has(chatId)) return;

      const promptText = (typeof text === "string" ? text.trim() : "") || (imageAttachment ? "Describe this image." : "");
      if (!promptText && !imageAttachment) return;

      const attachmentMeta = imageAttachment
        ? {
            name: imageAttachment.name,
            mimeType: imageAttachment.type || imageAttachment.mimeType,
            size: imageAttachment.size,
            previewUrl: imageAttachment.previewUrl,
          }
        : null;

      const userMsgId = addMessage(chatId, "user", promptText, "complete", undefined, attachmentMeta);
      const assistantMessageId = addMessage(chatId, "assistant", "", "thinking");

      const controller = new AbortController();
      abortControllersRef.current.set(chatId, controller);
      setStreamingChatId(chatId);

      const imagePayload = imageAttachment
        ? {
            name: imageAttachment.name,
            mimeType: imageAttachment.type || imageAttachment.mimeType,
            size: imageAttachment.size,
            data: imageAttachment.data,
          }
        : null;

      try {
        await api.sendMessageStream(
          chatId,
          { id: userMsgId, content: promptText, model, image: imagePayload },
          {
            onChunk: (delta) => {
              appendMessageChunk(chatId, assistantMessageId, delta);
            },
            onComplete: (data) => {
              finishMessage(
                chatId,
                assistantMessageId,
                data.reply,
                data.title,
                "complete"
              );
            },
            onStopped: (data) => {
              finishMessage(
                chatId,
                assistantMessageId,
                data.reply,
                null,
                "stopped"
              );
            },
            onError: () => {
              setMessageStatus(chatId, assistantMessageId, "error");
            },
          },
          controller.signal
        );
      } catch (err) {
        if (err.name === "AbortError" || controller.signal.aborted) {
          finishMessage(chatId, assistantMessageId, undefined, null, "stopped");
        } else {
          setMessageStatus(chatId, assistantMessageId, "error");
          addMessage(
            chatId,
            "error",
            err.message || "Something went wrong communicating with Aura. Please try again."
          );
        }
      } finally {
        abortControllersRef.current.delete(chatId);
        setStreamingChatId((prev) => (prev === chatId ? null : prev));
      }
    },
    [model, addMessage, appendMessageChunk, finishMessage, setMessageStatus]
  );

  /** Used from landing hero: creates a new chat synchronously and fires first turn */
  const startChat = useCallback(
    (text, imageAttachment = null) => {
      const id = createChat();
      sendInChat(id, text, imageAttachment);
      return id;
    },
    [createChat, sendInChat]
  );

  const handleStop = useCallback(
    (targetChatId) => {
      const id = targetChatId || streamingChatId || activeId;
      const controller = abortControllersRef.current.get(id);
      if (controller) {
        controller.abort();
        abortControllersRef.current.delete(id);
        setStreamingChatId((prev) => (prev === id ? null : prev));
      }
    },
    [streamingChatId, activeId]
  );

  const regenerateInChat = useCallback(
    (chatId) => {
      const chat = chats.find((c) => c.id === chatId);
      if (!chat || !chat.messages || chat.messages.length === 0) return;

      const lastUserMsg = [...chat.messages].reverse().find((m) => m.role === "user");
      if (!lastUserMsg) return;

      const lastMsg = chat.messages[chat.messages.length - 1];
      if (lastMsg && (lastMsg.role === "assistant" || lastMsg.role === "error")) {
        removeMessage(chatId, lastMsg.id);
      }

      sendInChat(chatId, lastUserMsg.content);
    },
    [chats, removeMessage, sendInChat]
  );

  const editAndRegenerate = useCallback(
    async (chatId, messageId, newContent) => {
      if (abortControllersRef.current.has(chatId)) return;

      const chat = chats.find((c) => c.id === chatId);
      if (!chat) return;

      // Preserve snapshot in case of failure to guarantee no message loss
      const originalMessages = [...(chat.messages || [])];
      const originalTitle = chat.title;

      const assistantMsgId = `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      truncateAndEditUserMessage(chatId, messageId, newContent, assistantMsgId);

      const controller = new AbortController();
      abortControllersRef.current.set(chatId, controller);
      setStreamingChatId(chatId);

      try {
        await api.editMessageStream(
          chatId,
          messageId,
          { content: newContent, model },
          {
            onChunk: (delta) => {
              appendMessageChunk(chatId, assistantMsgId, delta);
            },
            onComplete: (data) => {
              finishMessage(
                chatId,
                assistantMsgId,
                data.reply,
                data.title,
                "complete"
              );
            },
            onStopped: (data) => {
              finishMessage(
                chatId,
                assistantMsgId,
                data.reply,
                null,
                "stopped"
              );
            },
            onError: () => {
              setMessageStatus(chatId, assistantMsgId, "error");
            },
          },
          controller.signal
        );
      } catch (err) {
        if (err.name === "AbortError" || controller.signal.aborted) {
          finishMessage(chatId, assistantMsgId, undefined, null, "stopped");
        } else {
          // Failure: restore original message and chat state safely
          restoreChatState(chatId, originalMessages, originalTitle);
          setMessageStatus(chatId, assistantMsgId, "error");
          throw err;
        }
      } finally {
        abortControllersRef.current.delete(chatId);
        setStreamingChatId((prev) => (prev === chatId ? null : prev));
      }
    },
    [
      chats,
      model,
      truncateAndEditUserMessage,
      appendMessageChunk,
      finishMessage,
      setMessageStatus,
      restoreChatState,
    ]
  );

  const changeModel = useCallback((newModel) => {
    setModel(newModel);
    writeString(STORAGE_KEYS.MODEL, newModel);
  }, []);

  const value = {
    chats,
    activeChat,
    activeId,
    loaded,
    createChat,
    deleteChat,
    renameChat,
    selectChat,
    ensureMessagesLoaded,
    addMessage,
    removeMessage,
    model,
    changeModel,
    settingsOpen,
    setSettingsOpen,
    handleSaveSettings,
    busy,
    streamingChatId,
    sendInChat,
    regenerateInChat,
    editAndRegenerate,
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
