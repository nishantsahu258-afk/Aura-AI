import { useEffect, useRef } from "react";

/**
 * A soft water-ripple trail that follows the pointer. Meant for the
 * landing hero only — mount/unmount this component to turn it on/off
 * (it fully tears down its rAF loop and listeners on unmount).
 */
export default function CursorRipple() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let width = (canvas.width = canvas.offsetWidth * devicePixelRatio);
    let height = (canvas.height = canvas.offsetHeight * devicePixelRatio);
    ctx.scale(devicePixelRatio, devicePixelRatio);

    function resize() {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width * devicePixelRatio;
      canvas.height = height * devicePixelRatio;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(devicePixelRatio, devicePixelRatio);
    }
    window.addEventListener("resize", resize);

    const ripples = [];
    const colors = ["91,140,255", "118,87,232", "238,121,192"];
    let colorCycle = 0;
    let lastSpawn = 0;
    let raf = 0;

    function spawn(x, y) {
      const now = performance.now();
      if (now - lastSpawn < 55) return;
      lastSpawn = now;
      ripples.push({
        x,
        y,
        radius: 4,
        maxRadius: 70 + Math.random() * 40,
        alpha: 0.34,
        color: colors[colorCycle % colors.length],
      });
      colorCycle++;
      if (ripples.length > 40) ripples.shift();
    }

    function onMove(e) {
      const rect = canvas.getBoundingClientRect();
      spawn(e.clientX - rect.left, e.clientY - rect.top);
    }

    function onTouchMove(e) {
      const t = e.touches[0];
      if (!t) return;
      const rect = canvas.getBoundingClientRect();
      spawn(t.clientX - rect.left, t.clientY - rect.top);
    }

    // canvas is pointer-events:none so it never blocks clicks underneath —
    // listen on the wrapping container instead.
    const host = canvas.parentElement ?? canvas;
    host.addEventListener("pointermove", onMove);
    host.addEventListener("touchmove", onTouchMove, { passive: true });

    function tick() {
      ctx.clearRect(0, 0, width, height);
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += (r.maxRadius - r.radius) * 0.085;
        r.alpha *= 0.955;

        if (r.alpha < 0.008) {
          ripples.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r.color}, ${r.alpha})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius * 0.6, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r.color}, ${r.alpha * 0.5})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ mixBlendMode: "multiply" }}
      aria-hidden="true"
    />
  );
}
