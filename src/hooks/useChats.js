import { useCallback, useEffect, useMemo, useState } from "react";
import { readJSON, writeJSON, readString, writeString, STORAGE_KEYS } from "../lib/storage.js";
import { deriveTitle } from "../lib/prompt.js";

function makeId() {
  return `chat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeMessageId() {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function emptyChat() {
  const id = makeId();
  return {
    id,
    title: `New chat`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
}

/**
 * Owns everything the diagram's "localstorage" box represents:
 * the map of chat sessions (chat1, chat2, ...), the ordered sidebar
 * list, and which chat is currently active. Every mutation persists
 * immediately so a refresh never loses history.
 */
export function useChats() {
  const [chats, setChats] = useState(() => readJSON(STORAGE_KEYS.CHATS, {}));
  const [order, setOrder] = useState(() => readJSON(STORAGE_KEYS.CHAT_ORDER, []));
  const [activeId, setActiveId] = useState(() => readString(STORAGE_KEYS.ACTIVE_CHAT, ""));

  // Bootstrap: if a chat is active but missing, fallback to the first available chat.
  useEffect(() => {
    if (order.length > 0 && (!activeId || !chats[activeId])) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveId(order[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    writeJSON(STORAGE_KEYS.CHATS, chats);
  }, [chats]);
  useEffect(() => {
    writeJSON(STORAGE_KEYS.CHAT_ORDER, order);
  }, [order]);
  useEffect(() => {
    writeString(STORAGE_KEYS.ACTIVE_CHAT, activeId);
  }, [activeId]);

  const activeChat = chats[activeId] ?? null;

  const orderedChats = useMemo(
    () => order.map((id) => chats[id]).filter(Boolean),
    [order, chats]
  );

  const createChat = useCallback(() => {
    const chat = emptyChat();
    setChats((prev) => ({ ...prev, [chat.id]: chat }));
    setOrder((prev) => [chat.id, ...prev]);
    setActiveId(chat.id);
    return chat.id;
  }, []);

  const deleteChat = useCallback(
    (id) => {
      setChats((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setOrder((prev) => {
        const next = prev.filter((cid) => cid !== id);
        if (activeId === id) {
          setActiveId(next[0] ?? "");
        }
        return next;
      });
    },
    [activeId]
  );

  const renameChat = useCallback((id, title) => {
    setChats((prev) =>
      prev[id] ? { ...prev, [id]: { ...prev[id], title, updatedAt: Date.now() } } : prev
    );
  }, []);

  const selectChat = useCallback((id) => setActiveId(id), []);

  /** Append a message to a chat and return its id. */
  const addMessage = useCallback((chatId, role, content) => {
    const id = makeMessageId();
    setChats((prev) => {
      const chat = prev[chatId];
      if (!chat) return prev;
      const isFirstUserMessage = role === "user" && chat.messages.length === 0;
      const message = { id, role, content, timestamp: Date.now() };
      return {
        ...prev,
        [chatId]: {
          ...chat,
          title: isFirstUserMessage ? deriveTitle(content) : chat.title,
          messages: [...chat.messages, message],
          updatedAt: Date.now(),
        },
      };
    });
    return id;
  }, []);

  /** Update an existing message's content (used for error states). */
  const updateMessage = useCallback((chatId, messageId, content) => {
    setChats((prev) => {
      const chat = prev[chatId];
      if (!chat) return prev;
      return {
        ...prev,
        [chatId]: {
          ...chat,
          messages: chat.messages.map((m) =>
            m.id === messageId ? { ...m, content } : m
          ),
        },
      };
    });
  }, []);

  const removeMessage = useCallback((chatId, messageId) => {
    setChats((prev) => {
      const chat = prev[chatId];
      if (!chat) return prev;
      return {
        ...prev,
        [chatId]: { ...chat, messages: chat.messages.filter((m) => m.id !== messageId) },
      };
    });
  }, []);

  return {
    chats: orderedChats,
    activeChat,
    activeId,
    createChat,
    deleteChat,
    renameChat,
    selectChat,
    addMessage,
    updateMessage,
    removeMessage,
  };
}
