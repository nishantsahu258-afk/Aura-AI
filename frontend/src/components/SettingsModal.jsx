import { useState, useEffect } from "react";
import { X, Sliders, Sun, Moon, ShieldCheck, Copy, Check } from "lucide-react";
import { AVAILABLE_MODELS } from "../lib/gemini.js";
import { useApp } from "../context/AppContext.jsx";
import { getMe } from "../lib/api.js";
import CustomSelect from "./CustomSelect.jsx";

export default function SettingsModal({ model, onSave, onClose }) {
  const { theme, toggleTheme } = useApp();
  const [modelInput, setModelInput] = useState(model);

  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchProfile() {
      try {
        setLoadingProfile(true);
        setProfileError(false);
        const data = await getMe();
        if (isMounted) {
          if (data && data.userId) {
            setProfile(data);
          } else {
            setProfileError(true);
          }
        }
      } catch {
        if (isMounted) {
          setProfileError(true);
        }
      } finally {
        if (isMounted) {
          setLoadingProfile(false);
        }
      }
    }
    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleCopyUserId() {
    if (!profile?.userId) return;
    try {
      await navigator.clipboard.writeText(profile.userId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy user ID:", err);
    }
  }

  function formatMemberDate(timestamp) {
    if (!timestamp) return "";
    try {
      return new Date(timestamp).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "";
    }
  }

  function handleSave(e) {
    e.preventDefault();
    onSave({ model: modelInput });
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
              <Sliders size={17} style={{ color: "var(--color-primary)" }} />
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

        {/* Profile section */}
        <div className="mb-5">
          <label
            className="block text-secondary mb-2"
            style={{ fontSize: "var(--text-body-sm)" }}
          >
            Profile
          </label>
          <div
            className="rounded-[var(--radius-md)] p-3.5"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            {loadingProfile ? (
              <div className="flex flex-col gap-2 py-1 animate-pulse">
                <div
                  className="h-4 w-32 rounded-[var(--radius-xs)]"
                  style={{ background: "var(--color-border)" }}
                />
                <div
                  className="h-3 w-48 rounded-[var(--radius-xs)]"
                  style={{ background: "var(--color-border-subtle)" }}
                />
              </div>
            ) : profileError || !profile ? (
              <div
                className="py-1"
                style={{
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-foreground-muted)",
                }}
              >
                Profile unavailable
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span
                      style={{
                        fontSize: "var(--text-caption)",
                        color: "var(--color-foreground-muted)",
                      }}
                    >
                      User ID
                    </span>
                    <span
                      id="profile-user-id"
                      className="font-mono font-medium tracking-wide"
                      style={{
                        fontSize: "var(--text-body-sm)",
                        color: "var(--color-foreground)",
                      }}
                    >
                      {profile.userId}
                    </span>
                  </div>
                  <button
                    id="profile-copy-btn"
                    type="button"
                    onClick={handleCopyUserId}
                    title="Copy User ID"
                    aria-label="Copy User ID"
                    className="flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 transition-colors cursor-pointer"
                    style={{
                      background: "var(--color-background-elevated)",
                      border: "1px solid var(--color-border)",
                      color: copied ? "var(--color-primary)" : "var(--color-foreground-secondary)",
                      fontSize: "var(--text-caption)",
                    }}
                  >
                    {copied ? (
                      <>
                        <Check size={13} style={{ color: "var(--color-primary)" }} />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div
                  className="flex items-center justify-between pt-2 border-t"
                  style={{
                    borderColor: "var(--color-border-subtle)",
                    fontSize: "var(--text-caption)",
                  }}
                >
                  <div>
                    <span style={{ color: "var(--color-foreground-muted)" }}>Member since: </span>
                    <span style={{ color: "var(--color-foreground-secondary)", fontWeight: 500 }}>
                      {formatMemberDate(profile.createdAt)}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--color-foreground-muted)" }}>Chats: </span>
                    <span style={{ color: "var(--color-foreground-secondary)", fontWeight: 500 }}>
                      {profile.chatCount ?? 0}
                    </span>
                  </div>
                </div>

                <p
                  className="m-0 pt-0.5"
                  style={{
                    fontSize: "var(--text-caption)",
                    color: "var(--color-foreground-subtle)",
                    lineHeight: 1.35,
                  }}
                >
                  This ID is tied to this browser. Clearing site data creates a new one.
                </p>
              </div>
            )}
          </div>
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
            className="flex w-full items-center justify-between rounded-[var(--radius-md)] px-4 py-2.5 cursor-pointer"
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

        {/* Model */}
        <CustomSelect
          label="Model"
          options={AVAILABLE_MODELS}
          value={modelInput}
          onChange={setModelInput}
        />

        {/* Backend security indicator */}
        <div
          className="mt-5 flex items-center gap-2.5 rounded-[var(--radius-md)] p-3"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          <ShieldCheck size={18} style={{ color: "#10b981", flexShrink: 0 }} />
          <p
            className="text-muted m-0"
            style={{ fontSize: "var(--text-caption)", lineHeight: 1.4 }}
          >
            Chats are stored securely in your database. Deleting a chat in the app permanently removes it from the server.
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            id="settings-cancel-btn"
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-pill)] px-4 py-2 cursor-pointer"
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
            className="rounded-[var(--radius-pill)] px-4 py-2 font-semibold cursor-pointer"
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
