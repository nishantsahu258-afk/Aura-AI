import { useEffect, useRef } from "react";

export default function CustomCursor() {
  const cursorRef = useRef(null);
  const glowRef = useRef(null);
  const trailCanvasRef = useRef(null);

  // Keep mouse starting slightly off-screen
  const mouse = useRef({ x: -100, y: -100 });
  const pos = useRef({ x: -100, y: -100 });
  
  const hoverEl = useRef(null);    // magnetic targets only
  const anyHover = useRef(false);  // any interactive element hover
  const trail = useRef([]);
  
  useEffect(() => {
    let rafId;
    const canvas = trailCanvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Fit canvas to window
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const onMouseMove = (e) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;

      // Only apply magnetic effect to larger interactive elements, NOT tiny icon buttons
      const target = e.target.closest('a[href], .magnetic');
      hoverEl.current = target || null;

      // Track hover on any interactive element (for glow scale) — separate from magnetic
      const anyInteractive = e.target.closest('a, button, input, textarea, select, [role="button"]');
      anyHover.current = !!anyInteractive;
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });

    // Performance physics loop
    const render = () => {
      let targetX = mouse.current.x;
      let targetY = mouse.current.y;
      const isHovering = anyHover.current;

      // Magnetic hover physics — only for .magnetic / anchor elements
      if (hoverEl.current) {
        const rect = hoverEl.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const dx = mouse.current.x - centerX;
        const dy = mouse.current.y - centerY;

        // Pull factor (0.35 = snaps tightly but gives wiggle room)
        targetX = centerX + dx * 0.35;
        targetY = centerY + dy * 0.35;
      }

      // Instant tracking for natural cursor feel
      pos.current.x += (targetX - pos.current.x) * 1.0;
      pos.current.y += (targetY - pos.current.y) * 1.0;

      // Render DOM Transforms
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0) scale(${isHovering ? 2.5 : 1})`;
      }
      
      if (glowRef.current) {
        glowRef.current.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0) scale(${isHovering ? 1.5 : 1})`;
      }

      // Trail Engine
      trail.current.push({ x: pos.current.x, y: pos.current.y });
      if (trail.current.length > 20) {
        trail.current.shift();
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (trail.current.length > 1) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        
        for (let i = 1; i < trail.current.length; i++) {
          const pt = trail.current[i];
          const prevPt = trail.current[i - 1];
          
          ctx.beginPath();
          ctx.moveTo(prevPt.x, prevPt.y);
          ctx.lineTo(pt.x, pt.y);
          
          // Fade alpha & thickness based on age in the array
          const progress = i / trail.current.length;
          const alpha = progress * (isHovering ? 0.3 : 0.6); // Softer trail on hover
          
          ctx.strokeStyle = `rgba(238, 121, 192, ${alpha})`;
          ctx.lineWidth = isHovering ? 6 * progress : 3 * progress;
          ctx.stroke();
        }
      }

      rafId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[99999] overflow-hidden">
      {/* Dynamic Trail Canvas */}
      <canvas
        ref={trailCanvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ mixBlendMode: 'screen', filter: 'blur(1px)' }}
      />
      
      {/* Large Glowing Aura */}
      <div
        ref={glowRef}
        className="absolute left-0 top-0 -ml-[150px] -mt-[150px] w-[300px] h-[300px] rounded-full pointer-events-none transition-transform duration-300 ease-out"
        style={{
          background: 'radial-gradient(circle, rgba(118, 87, 232, 0.15) 0%, rgba(238, 121, 192, 0.1) 40%, rgba(0,0,0,0) 70%)',
          mixBlendMode: 'screen',
          willChange: 'transform',
        }}
      />

      {/* Core Sci-Fi Orb */}
      <div
        ref={cursorRef}
        className="absolute left-0 top-0 -ml-[4px] -mt-[4px] w-[8px] h-[8px] bg-white rounded-full pointer-events-none flex items-center justify-center transition-transform duration-300 ease-out"
        style={{
          boxShadow: '0 0 12px 2px rgba(238, 121, 192, 0.8), 0 0 24px 6px rgba(118, 87, 232, 0.6)',
          willChange: 'transform',
          mixBlendMode: 'screen',
        }}
      >
        <div className="w-[2px] h-[2px] bg-white rounded-full opacity-80" />
      </div>
    </div>
  );
}
