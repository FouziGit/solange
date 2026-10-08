"use client";

import { useEffect, useRef } from "react";

/**
 * Maillage 3D filaire plein écran (grille de points + lignes) qui ondule en
 * continu, réactif souris / toucher, dérive douce au repos. Port React de la
 * référence validée `design/login-3d/index.html` — Canvas 2D écrit à la main,
 * aucune dépendance. `prefers-reduced-motion` : rendu figé.
 */

// réglages — identiques à la référence
const SP = 0.62; // pas de grille (unités monde)
const AMP = 0.92; // amplitude verticale
const FOCAL = 3.15; // perspective
const CAMZ = 5.6; // recul caméra

// hauteur du champ (somme d'ondes → surface organique)
function field(x: number, z: number, t: number) {
  return (
    Math.sin(x * 0.62 + t * 0.55) * 0.62 +
    Math.sin(z * 0.54 - t * 0.42) * 0.6 +
    Math.sin((x + z) * 0.4 + t * 0.7) * 0.42 +
    Math.sin(x * 0.3 - z * 0.52 - t * 0.32) * 0.5 +
    Math.sin(x * 0.9 + z * 0.7 + t * 0.9) * 0.16
  );
}

// atténuation par profondeur → fondu vers le noir
function alpha(d: number) {
  const a = 1.15 - (d - (CAMZ - 3.2)) / 7.2;
  return a < 0 ? 0 : a > 1 ? 1 : a;
}

export function MeshBackground({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0;
    let H = 0;
    let DPR = 1;
    let COLS = 0;
    let ROWS = 0;
    const pt = { x: 0, y: 0, tx: 0, ty: 0 };
    // buffers réutilisés (sx, sy, profondeur, échelle)
    let sx = new Float32Array(0);
    let sy = new Float32Array(0);
    let sd = new Float32Array(0);
    let ss = new Float32Array(0);

    const resize = () => {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth;
      H = cv.clientHeight;
      cv.width = Math.floor(W * DPR);
      cv.height = Math.floor(H * DPR);
      // densité adaptée à l'écran (perf mobile)
      const base = Math.min(W, 900);
      COLS = Math.round(38 + base / 26);
      ROWS = Math.round(26 + base / 34);
      const n = COLS * ROWS;
      sx = new Float32Array(n);
      sy = new Float32Array(n);
      sd = new Float32Array(n);
      ss = new Float32Array(n);
    };

    const t0 = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const t = reduce ? 6.2 : (now - t0) / 1000;
      pt.x += (pt.tx - pt.x) * 0.06;
      pt.y += (pt.ty - pt.y) * 0.06;

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const unit = Math.max(W, H) * 0.3;
      const cx = W * 0.5 + pt.x * W * 0.04;
      const cy = H * 0.46 + pt.y * H * 0.03;
      const pitch = 1.02 + pt.y * 0.16;
      const yaw = pt.x * 0.22;
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);

      const cols = COLS;
      const rows = ROWS;
      const halfC = (cols - 1) / 2;
      const halfR = (rows - 1) / 2;
      let idx = 0;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const x = (i - halfC) * SP;
          const z = (j - halfR) * SP;
          const y = field(x, z, t) * AMP;
          // yaw (Y) puis pitch (X)
          const x1 = x * cosY - z * sinY;
          const z1 = x * sinY + z * cosY;
          const y2 = y * cosP - z1 * sinP;
          const z2 = y * sinP + z1 * cosP;
          const denom = Math.max(z2 + CAMZ, 0.2);
          const s = (FOCAL / denom) * unit;
          sx[idx] = cx + x1 * s;
          sy[idx] = cy - y2 * s;
          sd[idx] = denom;
          ss[idx] = s;
          idx++;
        }
      }

      ctx.lineWidth = 1;
      // lignes le long de X
      for (let j = 0; j < rows; j++) {
        ctx.beginPath();
        for (let i = 0; i < cols; i++) {
          const k = j * cols + i;
          if (i === 0) ctx.moveTo(sx[k], sy[k]);
          else ctx.lineTo(sx[k], sy[k]);
        }
        const a = alpha(sd[j * cols + (cols >> 1)]) * 0.55;
        ctx.strokeStyle = `rgba(214,220,232,${a.toFixed(3)})`;
        ctx.stroke();
      }
      // lignes le long de Z
      for (let i = 0; i < cols; i++) {
        ctx.beginPath();
        for (let j = 0; j < rows; j++) {
          const k = j * cols + i;
          if (j === 0) ctx.moveTo(sx[k], sy[k]);
          else ctx.lineTo(sx[k], sy[k]);
        }
        const a = alpha(sd[(rows >> 1) * cols + i]) * 0.55;
        ctx.strokeStyle = `rgba(214,220,232,${a.toFixed(3)})`;
        ctx.stroke();
      }
      // points aux sommets (carrés = rapides)
      for (let k = 0; k < idx; k++) {
        const a = alpha(sd[k]);
        if (a <= 0.02) continue;
        const r = Math.max(0.6, ss[k] * 0.01);
        ctx.fillStyle = `rgba(255,255,255,${(a * 0.9).toFixed(3)})`;
        ctx.fillRect(sx[k] - r, sy[k] - r, r * 2, r * 2);
      }

      if (!reduce) raf = requestAnimationFrame(frame);
    };

    let idle = 0;
    const setPointer = (x: number, y: number) => {
      idle = 0;
      pt.tx = (x / window.innerWidth - 0.5) * 2;
      pt.ty = (y / window.innerHeight - 0.5) * 2;
      if (reduce) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
      }
    };
    const onPointer = (e: PointerEvent) => setPointer(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const p = e.touches[0];
      if (p) setPointer(p.clientX, p.clientY);
    };
    const onResize = () => {
      resize();
      if (reduce) raf = requestAnimationFrame(frame);
    };

    // dérive douce et autonome quand le pointeur ne bouge pas
    const drift = window.setInterval(() => {
      idle++;
      if (idle > 40 && !reduce) {
        const s = Date.now() / 4200;
        pt.tx = Math.sin(s) * 0.5;
        pt.ty = Math.cos(s * 0.8) * 0.35;
      }
    }, 100);

    resize();
    raf = requestAnimationFrame(frame);
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(drift);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("touchmove", onTouch);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={className ?? "pointer-events-none absolute inset-0 size-full"}
    />
  );
}
