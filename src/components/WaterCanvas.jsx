import { useEffect, useRef } from "react";

/**
 * WaterCanvas — WebGL water ripple overlay.
 *
 * Renders glowing wave ripples that follow the cursor, creating
 * a genuine water-surface feel. The ripples use a 2D wave-physics
 * simulation on the CPU, then display it via a WebGL fragment shader
 * as luminous distortion rings that overlay the background.
 *
 * No SVG loading — the canvas is fully transparent except for the
 * wave energy, which appears as softly glowing colored rings.
 * mix-blend-mode: screen on the canvas adds these glows on top of
 * whatever background is underneath.
 */
export default function WaterCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false });
    if (!gl) return;

    // -------------------------------------------------------
    // Resize
    // -------------------------------------------------------
    let W = 0, H = 0;
    function resize() {
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width = W * devicePixelRatio;
      canvas.height = H * devicePixelRatio;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement ?? canvas);

    // -------------------------------------------------------
    // Wave simulation grid (CPU-side physics)
    // -------------------------------------------------------
    const GRID = 96;
    const cur  = new Float32Array(GRID * GRID);
    const prev = new Float32Array(GRID * GRID);

    function dropWave(nx, ny, strength) {
      const gx = Math.floor(nx * GRID);
      const gy = Math.floor(ny * GRID);
      const r = 4;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > r) continue;
          const ix = gx + dx, iy = gy + dy;
          if (ix < 0 || ix >= GRID || iy < 0 || iy >= GRID) continue;
          const f = 1 - d / r;
          cur[iy * GRID + ix] += strength * f * f;
        }
      }
    }

    function stepWave() {
      // Lower DAMP = wave dies out faster (stays closer to cursor)
      const DAMP = 0.95;
      // Lower SPEED = wave moves slower
      const SPEED = 0.15;
      const tmp = new Float32Array(GRID * GRID);
      for (let y = 1; y < GRID - 1; y++) {
        for (let x = 1; x < GRID - 1; x++) {
          const i = y * GRID + x;
          const neighbors = cur[(y - 1) * GRID + x] +
                            cur[(y + 1) * GRID + x] +
                            cur[y * GRID + x - 1] +
                            cur[y * GRID + x + 1];
          tmp[i] = (2 * cur[i] - prev[i] + SPEED * (neighbors - 4 * cur[i])) * DAMP;
        }
      }
      prev.set(cur);
      cur.set(tmp);
    }

    // -------------------------------------------------------
    // Shaders
    // -------------------------------------------------------
    const VS = `#version 300 es
      in vec2 a_pos;
      out vec2 v_uv;
      void main() {
        v_uv = a_pos * 0.5 + 0.5;
        gl_Position = vec4(a_pos, 0.0, 1.0);
      }
    `;

    // The fragment shader renders ONLY the wave energy as glowing rings.
    // The canvas is transparent where there's no wave activity.
    // Three brand colors blend based on position for a rainbow-water look.
    const FS = `#version 300 es
      precision highp float;
      uniform sampler2D u_wave;
      uniform float u_time;
      in vec2 v_uv;
      out vec4 fragColor;

      void main() {
        vec2 texel = 1.0 / vec2(float(${GRID}));

        // Wave height at this pixel
        float h = texture(u_wave, v_uv).r - 0.5;

        // Gradient of the wave field
        float hL = texture(u_wave, v_uv - vec2(texel.x, 0.0)).r - 0.5;
        float hR = texture(u_wave, v_uv + vec2(texel.x, 0.0)).r - 0.5;
        float hD = texture(u_wave, v_uv - vec2(0.0, texel.y)).r - 0.5;
        float hU = texture(u_wave, v_uv + vec2(0.0, texel.y)).r - 0.5;
        float grad = length(vec2(hR - hL, hU - hD));

        // Wave rings appear at the gradient (edge of wavefronts)
        float ring = grad * 2.5;
        float crest = max(0.0, h) * 1.5;
        float energy = ring + crest * 0.5;

        // Three brand colors that shift with position + time
        vec3 blue  = vec3(0.36, 0.55, 1.00); // #5b8cff
        vec3 pink  = vec3(0.93, 0.47, 0.75); // #ee79c0
        vec3 violet= vec3(0.46, 0.34, 0.91); // #7657e8

        float t = v_uv.x + v_uv.y * 0.5 + u_time * 0.1;
        float f1 = sin(t * 3.14) * 0.5 + 0.5;
        float f2 = sin(t * 3.14 + 2.09) * 0.5 + 0.5;
        vec3 col = mix(mix(blue, pink, f1), violet, f2 * 0.5);

        // Slight specular highlight on wave crests
        col += crest * vec3(0.4, 0.5, 0.6) * 0.6;

        float alpha = clamp(energy, 0.0, 1.0);

        fragColor = vec4(col * alpha, alpha * 0.75);
      }
    `;

    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn("WaterCanvas shader error:", gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }

    const vs = compile(gl.VERTEX_SHADER, VS);
    const fs = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("WaterCanvas link error:", gl.getProgramInfoLog(prog));
      return;
    }

    // -------------------------------------------------------
    // Fullscreen quad
    // -------------------------------------------------------
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1, -1,  1,
      -1,  1,  1, -1,  1,  1,
    ]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // -------------------------------------------------------
    // Wave texture (RGBA, updated each frame)
    // -------------------------------------------------------
    const waveTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, waveTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const uWave  = gl.getUniformLocation(prog, "u_wave");
    const uTime  = gl.getUniformLocation(prog, "u_time");

    // -------------------------------------------------------
    // Mouse / touch input
    // -------------------------------------------------------
    let lx = -1, ly = -1, lt = 0;

    function onMove(e) {
      const rect = canvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = 1 - (e.clientY - rect.top) / rect.height;
      const now = performance.now();
      const moved = Math.abs(nx - lx) + Math.abs(ny - ly);
      if (now - lt > 40 && moved > 0.001) {
        dropWave(nx, ny, 1.2 + moved * 8);
        lt = now; lx = nx; ly = ny;
      }
    }

    function onTouch(e) {
      const t = e.touches[0]; if (!t) return;
      const rect = canvas.getBoundingClientRect();
      dropWave((t.clientX - rect.left) / rect.width,
               1 - (t.clientY - rect.top) / rect.height, 2.0);
    }

    const host = canvas.parentElement ?? canvas;
    host.addEventListener("pointermove", onMove);
    host.addEventListener("touchmove", onTouch, { passive: true });

    // -------------------------------------------------------
    // Render loop
    // -------------------------------------------------------
    const bytes = new Uint8Array(GRID * GRID * 4);
    let raf = 0;
    const t0 = performance.now();

    // Enable blending for transparent canvas
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    function tick() {
      const t = (performance.now() - t0) / 1000;

      // One physics step per render for slower wave propagation
      stepWave();

      // Pack wave heights into RGBA bytes [0..255], offset 128 = 0
      for (let i = 0; i < GRID * GRID; i++) {
        const v = Math.round(Math.min(255, Math.max(0, (cur[i] * 0.5 + 0.5) * 255)));
        bytes[i * 4]     = v;
        bytes[i * 4 + 1] = v;
        bytes[i * 4 + 2] = v;
        bytes[i * 4 + 3] = 255;
      }

      gl.bindTexture(gl.TEXTURE_2D, waveTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
        GRID, GRID, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(prog);
      gl.bindVertexArray(vao);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, waveTex);
      gl.uniform1i(uWave, 0);
      gl.uniform1f(uTime, t);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("touchmove", onTouch);
      gl.deleteProgram(prog);
      gl.deleteTexture(waveTex);
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="water-canvas"
      aria-hidden="true"
    />
  );
}
