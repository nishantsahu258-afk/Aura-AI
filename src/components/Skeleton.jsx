export function SkeletonLine({ width = "100%", height = 12, style = {} }) {
  return (
    <div
      className="skeleton-shimmer"
      style={{
        width,
        height,
        borderRadius: "var(--radius-xs)",
        ...style,
      }}
    />
  );
}

/** Mimics an assistant bubble that hasn't started streaming yet. */
export function MessageSkeleton() {
  return (
    <div className="flex gap-3">
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full skeleton-shimmer"
        style={{ border: "1px solid var(--color-border-subtle)" }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
        <SkeletonLine width="82%" />
        <SkeletonLine width="94%" />
        <SkeletonLine width="58%" />
      </div>
    </div>
  );
}

/** A handful of message-shaped bars, used while a chat thread is loading. */
export function ChatSkeleton() {
  return (
    <div className="mx-auto flex w-full flex-col gap-6 px-4 py-8" style={{ maxWidth: "var(--container-chat)" }}>
      <div className="flex justify-end">
        <div className="skeleton-shimmer" style={{ width: "38%", height: 40, borderRadius: "var(--radius-xl)" }} />
      </div>
      <MessageSkeleton />
      <div className="flex justify-end">
        <div className="skeleton-shimmer" style={{ width: "26%", height: 40, borderRadius: "var(--radius-xl)" }} />
      </div>
      <MessageSkeleton />
    </div>
  );
}

/** Sidebar chat-list placeholder while chats are read from storage. */
export function SidebarSkeleton() {
  return (
    <div className="space-y-2 px-2.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="skeleton-shimmer"
          style={{ height: 38, borderRadius: "var(--radius-md)", opacity: 1 - i * 0.12 }}
        />
      ))}
    </div>
  );
}
