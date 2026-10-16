import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { createPortal } from "react-dom";

export default function CustomSelect({ options, value, onChange, label, compact = false, shortLabel }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: null, bottom: null, left: 0, width: 0 });
  const containerRef = useRef(null);
  const triggerRef = useRef(null);

  const selectedOption = options.find((o) => o.id === value) || options[0];
  // Estimate dropdown height: each option ~42px, max ~200px
  const estimatedDropdownHeight = Math.min(options.length * 42, 200);

  // Recalculate dropdown position every time it opens
  useLayoutEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUpward = spaceBelow < estimatedDropdownHeight + 8 && spaceAbove > spaceBelow;

      if (openUpward) {
        // Anchor to bottom of trigger — dropdown grows upward
        setDropdownPos({
          bottom: window.innerHeight - rect.top + 4,
          top: null,
          left: rect.left,
          width: Math.max(rect.width, compact ? 180 : rect.width),
        });
      } else {
        setDropdownPos({
          top: rect.bottom + 4,
          bottom: null,
          left: rect.left,
          width: Math.max(rect.width, compact ? 180 : rect.width),
        });
      }
    }
  }, [isOpen, estimatedDropdownHeight, compact]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        containerRef.current && 
        !containerRef.current.contains(e.target) &&
        !e.target.closest('.custom-select-dropdown')
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={compact ? "relative" : "relative w-full"} ref={containerRef}>
      {label && !compact && (
        <label
          className="mb-2 block text-secondary"
          style={{ fontSize: "var(--text-body-sm)" }}
        >
          {label}
        </label>
      )}

      {compact ? (
        /* ── Compact pill (inline inside chat bar) ── */
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
          style={{
            background: isOpen ? "var(--color-surface-active)" : "var(--color-surface-hover)",
            border: isOpen ? "1px solid var(--color-border-primary)" : "1px solid var(--color-border)",
            color: "var(--color-foreground-secondary)",
            fontSize: "0.8rem",
            fontWeight: 500,
            lineHeight: 1,
            whiteSpace: "nowrap",
            transition: "background 150ms ease, border-color 150ms ease",
          }}
        >
          {/* Colored indicator dot */}
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #5b8cff, #7657e8)",
              flexShrink: 0,
              display: "inline-block",
            }}
          />
          <span>{shortLabel || selectedOption?.label}</span>
          <ChevronDown
            size={12}
            style={{
              color: "var(--color-foreground-muted)",
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 180ms ease",
            }}
          />
        </button>
      ) : (
        /* ── Full-width select (Settings modal) ── */
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center justify-between px-3.5 py-2 rounded-[var(--radius-md)] text-left"
          style={{
            background: "var(--color-surface)",
            border: isOpen ? "1px solid var(--color-border-primary)" : "1px solid var(--color-border)",
            color: "var(--color-foreground)",
            fontSize: "var(--text-body-sm)",
            boxShadow: isOpen ? "0 0 0 2px var(--selection-background)" : "none",
            transition: "border-color 150ms ease, box-shadow 150ms ease",
          }}
        >
          <span className="truncate pr-2">{selectedOption?.label}</span>
          <ChevronDown
            size={15}
            style={{
              flexShrink: 0,
              color: "var(--color-foreground-muted)",
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 200ms ease",
            }}
          />
        </button>
      )}

      {isOpen && createPortal(
        <div
          className="custom-select-dropdown"
          style={{
            position: "fixed",
            ...(dropdownPos.top !== null
              ? { top: dropdownPos.top }
              : { bottom: dropdownPos.bottom }),
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 99998,
            background: "var(--color-background-elevated)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-lg)",
            maxHeight: "250px",
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt.id);
                setIsOpen(false);
              }}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left"
              style={{
                background: value === opt.id ? "var(--color-surface-active)" : "transparent",
                color: "var(--color-foreground)",
                fontSize: "var(--text-body-sm)",
                border: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                if (value !== opt.id) e.currentTarget.style.background = "var(--color-surface-hover)";
              }}
              onMouseLeave={(e) => {
                if (value !== opt.id) e.currentTarget.style.background = "transparent";
              }}
            >
              <span className="truncate pr-2">{opt.label}</span>
              {value === opt.id && <Check size={15} style={{ flexShrink: 0, color: "var(--color-primary)" }} />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
