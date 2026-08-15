export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-1" aria-label="Aura is typing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="typing-dot"
          style={{
            width: 6,
            height: 6,
            borderRadius: "999px",
            background: "var(--color-primary)",
            animationDelay: `${i * 0.18}s`,
            display: "inline-block",
          }}
        />
      ))}
    </div>
  );
}
