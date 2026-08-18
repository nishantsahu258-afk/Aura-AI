import { useNavigate } from "react-router-dom";
import { Sparkles, MessageSquare, Settings, Sun, Moon } from "lucide-react";
import LogoLockup from "../components/LogoLockup.jsx";
import HeroInput from "../components/HeroInput.jsx";
import WaterCanvas from "../components/WaterCanvas.jsx";
import { useApp } from "../context/AppContext.jsx";

const SUGGESTIONS = [
  "Explain quantum computing simply",
  "Draft a friendly follow-up email",
  "Plan a 3-day trip to Kyoto",
  "Help me debug a React useEffect loop",
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { apiKey, chats, activeId, startChat, setSettingsOpen, theme, toggleTheme } = useApp();

  function handleSend(text) {
    if (!apiKey) {
      setSettingsOpen(true);
      return;
    }
    const id = startChat(text);
    if (id) navigate(`/chat/${id}`);
  }

  const mostRecentChatId = chats[0]?.id ?? activeId;

  return (
    <div className="aura-landing-wrapper">

      {/* Pulse SVG — fills entire viewport creating Image-1 gradient look */}
      <img
        src="/pulse.svg"
        alt=""
        aria-hidden="true"
        className="aura-pulse-bg"
        draggable={false}
      />

      {/* WebGL water ripple overlay — glowing waves follow the cursor */}
      <WaterCanvas theme={theme} />

      {/* ── Nav ── */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <LogoLockup />
        <nav className="flex items-center gap-2">
          {chats.length > 0 && (
            <button
              id="landing-recent-chats-btn"
              onClick={() => navigate(`/chat/${mostRecentChatId}`)}
              className="icon-btn nav-pill flex items-center gap-1.5 rounded-full px-3.5 py-2"
              style={{
                fontSize: "var(--text-body-sm)",
                color: "var(--color-foreground-secondary)",
              }}
            >
              <MessageSquare size={15} />
              <span className="hidden sm:inline">Your chats</span>
            </button>
          )}

          {/* Theme toggle */}
          <button
            id="landing-theme-toggle-btn"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            onClick={toggleTheme}
            className="theme-toggle"
          >
            {theme === "dark"
              ? <Sun size={16} />
              : <Moon size={16} />
            }
          </button>

          <button
            id="landing-settings-btn"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
            className="icon-btn nav-pill flex h-9 w-9 items-center justify-center rounded-full"
            style={{ color: "var(--color-foreground-secondary)" }}
          >
            <Settings size={16} />
          </button>
        </nav>
      </header>
      

      {/* ── Hero ── */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-16">
        <div className="w-full flex flex-col items-center  max-w-2xl text-center">

          {/* Main heading — plain foreground, text-shadow for readability on gradient */}
          <h1
            className="animate-fade-in-up"
            style={{
              fontSize: "clamp(2.25rem, 5vw, 3.25rem)",
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: theme === "dark" ? "#ffffff" : "#0d0d0d",
              textShadow: theme === "light"
                ? "0 1px 20px rgb(255 255 255 / 0.8), 0 0 40px rgb(255 255 255 / 0.4)"
                : "none",
            }}
          >
            Say the thing.{" "}
            <span style={{ fontStyle: "italic" }}>Aura&apos;s</span>{" "}
            got it.
          </h1>

         

          {/* Chat input */}
          <div
            className="animate-fade-in-up w-full stagger mt-8"
            style={{ "--delay": "160ms" }}
          >
            <HeroInput onSend={handleSend} disabled={false} />
          </div>

          {/* Suggestion chips */}
          <div
            className="animate-fade-in-up stagger mx-auto mt-6 flex max-w-xl flex-wrap items-center justify-center gap-2"
            style={{ "--delay": "240ms" }}
          >
            {SUGGESTIONS.map((s, i) => (
              <button
                key={s}
                id={`landing-suggestion-${i}`}
                onClick={() => handleSend(s)}
                className="suggestion-chip nav-pill animate-fade-in-up stagger rounded-full px-4 py-2"
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-foreground-secondary)",
                  "--delay": `${300 + i * 60}ms`,
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* API key notice if missing */}
          {!apiKey && (
            <div
              className="animate-fade-in-up stagger mx-auto mt-6"
              style={{ "--delay": "480ms" }}
            >
              <button
                id="landing-add-key-btn"
                onClick={() => setSettingsOpen(true)}
                className="hero-cta mx-auto flex items-center gap-2 rounded-full px-5 py-2.5"
                style={{
                  background: "var(--brand-gradient)",
                  color: "var(--color-on-brand)",
                  fontSize: "var(--text-body-sm)",
                  fontWeight: 600,
                  border: "none",
                  boxShadow: "0 12px 30px rgb(91 140 255 / 0.3)",
                }}
              >
                <Sparkles size={15} />
                Add your Gemini API key to begin
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
