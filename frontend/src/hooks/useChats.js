import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { readJSON, readString, writeString, remove, STORAGE_KEYS } from "../lib/storage.js";

function makeId() {
  return `chat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeMessageId() {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function useChats() {
  const [chats, setChats] = useState([]);
  const [activeId, setActiveIdState] = useState(() => readString(STORAGE_KEYS.ACTIVE_CHAT, ""));
  const [loaded, setLoaded] = useState(false);

  const setActiveId = useCallback((id) => {
    setActiveIdState(id);
    writeString(STORAGE_KEYS.ACTIVE_CHAT, id);
  }, []);

  // 1. Fetch initial chat list from GET /api/chats on startup (sidebar only needs id, title, updatedAt)
  useEffect(() => {
    let isMounted = true;

    async function initChats() {
      try {
        // One-time optional migration of legacy localStorage chats
        const legacyChats = readJSON("chats", null);
        if (legacyChats && Object.keys(legacyChats).length > 0) {
          try {
            await api.post("/api/chats/import", {
              chats: Object.values(legacyChats),
            });
            remove("chats");
            remove("chat-order");
          } catch (e) {
            console.warn("Could not import legacy localStorage chats:", e);
          }
        }

        const list = await api.listChats();
        if (!isMounted) return;

        setChats((prev) => {
          const listMap = new Map(list.map((c) => [c.id, c]));
          const merged = prev.map((p) => {
            if (listMap.has(p.id)) {
              const remote = listMap.get(p.id);
              listMap.delete(p.id);
              return {
                ...remote,
                title: remote.title || p.title,
                messages: p.messages && p.messages.length > 0 ? p.messages : (remote.messages || []),
                messagesLoaded: p.messagesLoaded || false,
              };
            }
            return p;
          });
          return [...merged, ...listMap.values()];
        });

        const storedActive = readString(STORAGE_KEYS.ACTIVE_CHAT, "");
        if (list.length > 0) {
          const exists = list.some((c) => c.id === storedActive);
          if (!exists && !storedActive) {
            setActiveId(list[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load chats from backend:", err);
      } finally {
        if (isMounted) setLoaded(true);
      }
    }

    initChats();

    return () => {
      isMounted = false;
    };
  }, [setActiveId]);

  const fetchingRef = useRef(new Set());

  // Helper to fetch full chat with messages from GET /api/chats/:id
  const loadMessages = useCallback(async (id) => {
    if (!id || fetchingRef.current.has(id)) return;
    fetchingRef.current.add(id);

    try {
      const full = await api.getChat(id);
      if (!full) return;

      setChats((prev) => {
        const remoteMsgs = Array.isArray(full.messages) ? full.messages : [];
        const exists = prev.some((c) => c.id === id);

        if (!exists) {
          return [
            {
              id,
              title: full.title || "New chat",
              messages: remoteMsgs,
              messagesLoaded: true,
              createdAt: full.createdAt || Date.now(),
              updatedAt: full.updatedAt || Date.now(),
            },
            ...prev,
          ];
        }

        return prev.map((c) => {
          if (c.id !== id) return c;

          const localMsgs = c.messages || [];
          const hasInFlight = localMsgs.some(
            (m) => m.status === "thinking" || m.status === "streaming"
          );

          // If local chat currently has active in-flight messages (thinking/streaming),
          // DO NOT clobber them with stale remote messages!
          if (hasInFlight) {
            return {
              ...c,
              title: full.title || c.title,
              messagesLoaded: true,
            };
          }

          // If local chat already has more messages than remote (e.g. recent turn added),
          // preserve local messages to prevent race-condition data loss
          let nextMessages = remoteMsgs;
          if (localMsgs.length > remoteMsgs.length) {
            nextMessages = localMsgs;
          } else if (remoteMsgs.length === 0 && localMsgs.length > 0) {
            nextMessages = localMsgs;
          }

          return {
            ...c,
            title: full.title || c.title,
            messages: nextMessages,
            messagesLoaded: true,
            updatedAt: full.updatedAt || c.updatedAt,
          };
        });
      });
    } catch (err) {
      console.warn(`Could not load messages for chat ${id}:`, err);
    } finally {
      fetchingRef.current.delete(id);
    }
  }, []);

  // 2. Load a chat's messages whenever activeId is set or chats array initializes
  useEffect(() => {
    if (!activeId) return;

    const current = chats.find((c) => c.id === activeId);
    if (!current || (!current.messagesLoaded && (!current.messages || current.messages.length === 0))) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadMessages(activeId);
    }
  }, [activeId, chats, loadMessages]);

  const activeChat = chats.find((c) => c.id === activeId) ?? null;

  // 3. createChat() must stay synchronous (Gotcha 1)
  const createChat = useCallback(() => {
    const id = makeId();
    const newChat = {
      id,
      title: "New chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      messagesLoaded: true,
    };

    setChats((prev) => [newChat, ...prev]);
    setActiveId(id);

    // Call POST /api/chats in the background
    api.createChat(id).catch((err) => {
      console.warn("Background chat creation:", err.message);
    });

    return id;
  }, [setActiveId]);

  // 4. deleteChat(id): update state immediately, then call DELETE /api/chats/:id and refresh list
  const deleteChat = useCallback(
    async (id) => {
      setChats((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (activeId === id) {
          setActiveId(next[0]?.id ?? "");
        }
        return next;
      });

      try {
        await api.deleteChat(id);
        const freshList = await api.listChats();
        if (Array.isArray(freshList)) {
          setChats((prev) => {
            const freshIds = new Set(freshList.map((fc) => fc.id));
            const freshMapped = freshList.map((fc) => {
              const existing = prev.find((p) => p.id === fc.id);
              return existing
                ? {
                    ...fc,
                    messages: existing.messages || [],
                    messagesLoaded: existing.messagesLoaded,
                  }
                : fc;
            });
            const localRemaining = prev.filter((p) => p.id !== id && !freshIds.has(p.id));
            return [...localRemaining, ...freshMapped];
          });
        }
      } catch (err) {
        console.error(`Failed to delete chat ${id}:`, err);
      }
    },
    [activeId, setActiveId]
  );

  const renameChat = useCallback((id, title) => {
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title, updatedAt: Date.now() } : c))
    );

    api.renameChat(id, title).catch((err) => {
      console.error(`Failed to rename chat ${id}:`, err);
    });
  }, []);

  const selectChat = useCallback(
    (id) => {
      setActiveId(id);
    },
    [setActiveId]
  );

  // 5. addMessage, appendMessageChunk, finishMessage, setMessageStatus, removeMessage
  const addMessage = useCallback((chatId, role, content, status = "complete", customId, attachment = null) => {
    const id = customId || makeMessageId();
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat;
        const message = { id, role, content, attachment, status, timestamp: Date.now() };
        return {
          ...chat,
          messagesLoaded: true,
          messages: [...(chat.messages || []), message],
          updatedAt: Date.now(),
        };
      })
    );
    return id;
  }, []);

  const appendMessageChunk = useCallback((chatId, messageId, delta) => {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat;
        const msgs = chat.messages || [];
        const hasMsg = msgs.some((m) => m.id === messageId);
        const nextMsgs = hasMsg
          ? msgs.map((m) => {
              if (m.id !== messageId) return m;
              return {
                ...m,
                content: (m.content || "") + delta,
                status: "streaming",
              };
            })
          : [
              ...msgs,
              {
                id: messageId,
                role: "assistant",
                content: delta,
                status: "streaming",
                timestamp: Date.now(),
              },
            ];

        return {
          ...chat,
          messages: nextMsgs,
        };
      })
    );
  }, []);

  const finishMessage = useCallback((chatId, messageId, finalContent, updatedTitle, status = "complete") => {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat;
        const msgs = chat.messages || [];
        const hasMsg = msgs.some((m) => m.id === messageId);
        const nextMsgs = hasMsg
          ? msgs.map((m) => {
              if (m.id !== messageId) return m;
              return {
                ...m,
                content: finalContent !== undefined ? finalContent : m.content,
                status,
              };
            })
          : [
              ...msgs,
              {
                id: messageId,
                role: "assistant",
                content: finalContent !== undefined ? finalContent : "",
                status,
                timestamp: Date.now(),
              },
            ];

        return {
          ...chat,
          title: updatedTitle || chat.title,
          updatedAt: Date.now(),
          messages: nextMsgs,
        };
      })
    );
  }, []);

  const setMessageStatus = useCallback((chatId, messageId, status) => {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat;
        return {
          ...chat,
          messages: (chat.messages || []).map((m) =>
            m.id === messageId ? { ...m, status } : m
          ),
        };
      })
    );
  }, []);

  const updateMessage = useCallback((chatId, messageId, content, updatedTitle) => {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat;
        const msgs = chat.messages || [];
        const hasId = msgs.some((m) => m.id === messageId);
        const nextMsgs = hasId
          ? msgs.map((m) => (m.id === messageId ? { ...m, content } : m))
          : [...msgs, { id: messageId, role: "assistant", content, status: "complete", timestamp: Date.now() }];

        return {
          ...chat,
          title: updatedTitle || chat.title,
          updatedAt: Date.now(),
          messages: nextMsgs,
          messagesLoaded: true,
        };
      })
    );
  }, []);

  const removeMessage = useCallback((chatId, messageId) => {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat;
        return {
          ...chat,
          messages: (chat.messages || []).filter((m) => m.id !== messageId),
        };
      })
    );
  }, []);

  const truncateAndEditUserMessage = useCallback((chatId, messageId, newContent, assistantMsgId) => {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat;
        const msgs = chat.messages || [];
        const index = msgs.findIndex((m) => m.id === messageId);
        if (index === -1) return chat;

        const truncated = msgs.slice(0, index + 1).map((m) =>
          m.id === messageId ? { ...m, content: newContent } : m
        );

        const assistantMsg = {
          id: assistantMsgId,
          role: "assistant",
          content: "",
          status: "thinking",
          timestamp: Date.now(),
        };

        return {
          ...chat,
          messages: [...truncated, assistantMsg],
          updatedAt: Date.now(),
        };
      })
    );
  }, []);

  const restoreChatState = useCallback((chatId, backupMessages, backupTitle) => {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat;
        return {
          ...chat,
          messages: backupMessages,
          title: backupTitle ?? chat.title,
        };
      })
    );
  }, []);

  const ensureMessagesLoaded = useCallback(
    (id) => {
      if (!id) return;
      const current = chats.find((c) => c.id === id);
      const hasInFlight = (current?.messages || []).some(
        (m) => m.status === "thinking" || m.status === "streaming"
      );
      if (current?.messagesLoaded && (current.messages?.length > 0 || hasInFlight)) {
        return;
      }
      loadMessages(id);
    },
    [chats, loadMessages]
  );

  return {
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
    updateMessage,
    removeMessage,
    truncateAndEditUserMessage,
    restoreChatState,
  };
}
