import { useState } from "react";
import { Eye, EyeOff, X, KeyRound, ExternalLink, Sun, Moon } from "lucide-react";
import { AVAILABLE_MODELS } from "../lib/gemini.js";
import { useApp } from "../context/AppContext.jsx";
import CustomSelect from "./CustomSelect.jsx";

export default function SettingsModal({ apiKey, model, onSave, onClose }) {
  const { theme, toggleTheme } = useApp();
  const [keyInput, setKeyInput] = useState(apiKey);
  const [modelInput, setModelInput] = useState(model);
  const [reveal, setReveal] = useState(false);

  function handleSave(e) {
    e.preventDefault();
    onSave({ apiKey: keyInput.trim(), model: modelInput });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgb(0 0 0 / 0.65)", backdropFilter: "blur(4px)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSave}
        className="animate-scale-in w-full max-w-md rounded-[var(--radius-2xl)] p-6"
        style={{
          background: "var(--color-background-elevated)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)]"
              style={{ background: "var(--brand-gradient-soft)" }}
            >
              <KeyRound size={17} style={{ color: "var(--color-primary)" }} />
            </div>
            <h5 style={{ margin: 0, color: "var(--color-foreground)" }}>Settings</h5>
          </div>
          <button
            id="settings-close-btn"
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="icon-btn rounded-[var(--radius-sm)] p-1.5"
            style={{ background: "transparent", color: "var(--color-foreground-muted)" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Theme toggle */}
        <div className="mb-5">
          <label
            className="block text-secondary mb-2"
            style={{ fontSize: "var(--text-body-sm)" }}
          >
            Appearance
          </label>
          <button
            id="settings-theme-toggle-btn"
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center justify-between rounded-[var(--radius-md)] px-4 py-2.5"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-foreground-secondary)",
              fontSize: "var(--text-body-sm)",
            }}
          >
            <span className="flex items-center gap-2">
              {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
              {theme === "dark" ? "Dark mode" : "Light mode"}
            </span>
            <span
              style={{
                fontSize: "var(--text-caption)",
                color: "var(--color-foreground-subtle)",
              }}
            >
              Click to toggle
            </span>
          </button>
        </div>

        {/* API Key */}
        <label
          className="text-secondary"
          style={{ fontSize: "var(--text-body-sm)" }}
        >
          Gemini API key
        </label>
        <div
          className="chat-input mt-2 flex items-center gap-2 px-3.5"
          style={{ borderRadius: "var(--radius-md)" }}
        >
          <input
            id="settings-api-key-input"
            type={reveal ? "text" : "password"}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="AIza…"
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-transparent py-2.5"
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              boxShadow: "none",
              color: "var(--color-foreground)",
            }}
          />
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? "Hide key" : "Show key"}
            style={{ background: "transparent", border: "none", color: "var(--color-foreground-muted)" }}
          >
            {reveal ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>

        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1"
          style={{ fontSize: "var(--text-caption)", color: "var(--color-primary)" }}
        >
          Get a free key from Google AI Studio <ExternalLink size={12} />
        </a>

        {/* Model */}
        <CustomSelect
          label="Model"
          options={AVAILABLE_MODELS}
          value={modelInput}
          onChange={setModelInput}
        />

        <p
          className="mt-4 text-muted"
          style={{ fontSize: "var(--text-caption)" }}
        >
          Your key is stored only in this browser&apos;s local storage. It&apos;s never sent anywhere
          except directly to Google&apos;s Gemini API.
        </p>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            id="settings-cancel-btn"
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-pill)] px-4 py-2"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-foreground-secondary)",
              fontSize: "var(--text-body-sm)",
            }}
          >
            Cancel
          </button>
          <button
            id="settings-save-btn"
            type="submit"
            className="rounded-[var(--radius-pill)] px-4 py-2 font-semibold"
            style={{
              background: "var(--brand-gradient)",
              color: "var(--color-on-brand)",
              fontSize: "var(--text-body-sm)",
              border: "none",
            }}
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
