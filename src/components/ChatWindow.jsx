import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble.jsx";
import { MessageSkeleton, ChatSkeleton } from "./Skeleton.jsx";
import ChatInput from "./ChatInput.jsx";

export default function ChatWindow({ chat, busy, loading, onSend, onStop }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat?.messages?.length, busy]);

  const messages = chat?.messages ?? [];

  return (
    // min-h-0 is critical: without it, flexbox children can grow beyond
    // the available height and push the input off-screen.
    <div className="chat-background flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {/* Scrollable messages area — takes all remaining space */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <ChatSkeleton />
        ) : (
          <div className="mx-auto flex flex-col gap-6 px-4 py-8" style={{ maxWidth: "var(--container-chat)" }}>
            {messages.map((m) => (
              <div key={m.id} className="animate-fade-in-up" style={{ animationDuration: "0.4s" }}>
                <MessageBubble message={m} />
              </div>
            ))}
            {busy && <MessageSkeleton />}
          </div>
        )}
      </div>

      {/* Input — always pinned at the bottom, never shrinks */}
      <div className="shrink-0 px-4 pb-5 pt-2">
        <ChatInput onSend={onSend} onStop={onStop} disabled={busy} busy={busy} />
      </div>
    </div>
  );
}

