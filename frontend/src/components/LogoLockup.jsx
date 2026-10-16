import Logo from "./Logo.jsx";

export default function LogoLockup({ size = 26, textSize = "1.125rem", animated = true, className = "" }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Logo size={size} animated={animated} />
      <span
        style={{
          fontSize: textSize,
          fontWeight: 750,
          letterSpacing: "-0.03em",
          color: "var(--color-foreground)",
        }}
      >
        Aura999+
      </span>
    </div>
  );
}
