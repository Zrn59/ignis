import { useEffect, useRef } from "react";

// A drawing of a candle flame, not a combustion model. Gravity drives the
// buoyant plume, so the outline goes from a steady blue sphere at 0 g to a
// flickering yellow teardrop at 1 g. Oxygen scales size and brightness.

interface Spark {
  angle: number;
  dist: number;
  speed: number;
  age: number;
  life: number;
  alive: boolean;
}

const BG = "#000000";
const STRETCH = 2.2;
const BLUE = [56, 128, 255];
const AMBER = [255, 168, 64];

const mix = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const rgba = (c: number[], alpha: number) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, alpha))})`;

/** Flame boundary around the wick: φ = 0 points up. */
function outline(cx: number, cy: number, radius: number, gn: number, t: number, steps = 120): Path2D {
  const path = new Path2D();
  for (let i = 0; i <= steps; i++) {
    const phi = (i / steps) * Math.PI * 2;
    const up = (1 + Math.cos(phi)) / 2;
    let r = radius * (1 + STRETCH * gn * up ** 2.2) * (1 - 0.5 * gn * (1 - up));
    r *= 1 + gn * up * (0.06 * Math.sin(3 * phi + 7 * t) + 0.04 * Math.sin(5 * phi - 11 * t)) + 0.012 * Math.sin(1.4 * t);
    const sway = gn * radius * 0.22 * Math.sin(2.3 * t) * up ** 3;
    const taper = 1 - 0.5 * gn - 0.35 * gn * up ** 3;
    const x = cx + Math.sin(phi) * r * taper + sway;
    const y = cy - Math.cos(phi) * r;
    if (i) path.lineTo(x, y);
    else path.moveTo(x, y);
  }
  path.closePath();
  return path;
}

export function FlameCanvas({ g, o2, paused = false }: { g: number; o2: number; paused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const target = useRef({ g, o2, paused });
  target.current = { g, o2, paused };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const sparks: Spark[] = Array.from({ length: 160 }, () => ({ angle: 0, dist: 0, speed: 0, age: 0, life: 1, alive: false }));

    let width = 0;
    let height = 0;
    let scale = 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scale = Math.min(width, height) / 440;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    // eased copies of the props, so switching environments morphs the flame
    const state = { g: target.current.g, o2: target.current.o2, t: 0 };
    let carry = 0;

    const step = (dt: number) => {
      state.g += (target.current.g - state.g) * Math.min(1, dt * 2.5);
      state.o2 += (target.current.o2 - state.o2) * Math.min(1, dt * 2.5);
      state.t += dt;
      const gn = Math.sqrt(Math.max(0, Math.min(1, state.g)));
      carry += dt * (14 + 40 * gn * gn);
      while (carry >= 1) {
        carry -= 1;
        const s = sparks.find((p) => !p.alive);
        if (!s) break;
        s.angle = gn > 0.5 ? (Math.random() - 0.5) * 0.9 : Math.random() * Math.PI * 2;
        s.dist = 0.8 + Math.random() * 0.25;
        s.speed = 0.15 + Math.random() * 0.35 + gn * 1.6;
        s.age = 0;
        s.life = 0.8 + Math.random() * 1.2;
        s.alive = true;
      }
      for (const s of sparks) {
        if (!s.alive) continue;
        s.age += dt;
        s.dist += s.speed * dt;
        if (s.age > s.life) s.alive = false;
      }
    };

    const draw = () => {
      const gn = Math.sqrt(Math.max(0, Math.min(1, state.g)));
      const intensity = Math.max(0.45, Math.min(1.6, (state.o2 - 10) / 22));
      const radius = 68 * scale * (0.8 + 0.22 * intensity) * (1 - 0.12 * gn);
      const cx = width / 2;
      const cy = height / 2 + radius * 1.35 * gn;
      const t = state.t;

      ctx.globalCompositeOperation = "source-over";
      ctx.filter = "none";
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, width, height);

      // instrument reticle, fixed to the panel centre
      ctx.strokeStyle = "rgba(143,154,168,0.13)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(width / 2 - 14, height / 2);
      ctx.lineTo(width / 2 + 14, height / 2);
      ctx.moveTo(width / 2, height / 2 - 14);
      ctx.lineTo(width / 2, height / 2 + 14);
      ctx.stroke();
      for (const r of [80, 160, 240]) {
        ctx.setLineDash(r === 160 ? [2, 5] : []);
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, r * scale, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      const shape = outline(cx, cy, radius, gn, t);
      const core = outline(cx, cy - radius * 0.25 * gn, radius * 0.72, gn, t + 0.4);
      const top = cy - radius * (1 + STRETCH * gn);
      const bright = 0.55 + 0.35 * intensity;

      // Blue and amber never blend in one spot (additively they turn lavender):
      // the base stays blue, the luminous zone above it is amber, and the
      // boundary drops as gravity grows.
      const split = Math.max(0.12, 1 - 0.95 * gn);
      const vertical = (blueAlpha: number, amberAlpha: number) => {
        const grad = ctx.createLinearGradient(0, cy + radius, 0, top);
        grad.addColorStop(0, rgba(BLUE, blueAlpha));
        grad.addColorStop(Math.max(0, split - 0.1), rgba(BLUE, blueAlpha));
        if (split < 1) {
          grad.addColorStop(Math.min(1, split + 0.1), rgba(AMBER, amberAlpha));
          grad.addColorStop(1, rgba(AMBER, amberAlpha));
        }
        return grad;
      };

      ctx.globalCompositeOperation = "lighter";

      // wide halo
      ctx.filter = `blur(${Math.round(26 * scale)}px)`;
      ctx.fillStyle = vertical(0.24 * bright, 0.2 * bright);
      ctx.fill(shape);

      // body: dim centre, bright limb, the way a spherical shell looks in projection
      ctx.filter = `blur(${Math.round(5 * scale)}px)`;
      const fade = 1 - 0.8 * gn;
      const body = ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius * (1 + gn));
      body.addColorStop(0, rgba(BLUE, 0.04 * bright * fade));
      body.addColorStop(0.7, rgba(BLUE, 0.2 * bright * fade));
      body.addColorStop(1, rgba(mix(BLUE, [150, 196, 255], 0.5), 0.45 * bright * fade));
      ctx.fillStyle = body;
      ctx.fill(shape);

      // glowing soot: only buoyant flames get it
      if (gn > 0.02) {
        const soot = ctx.createLinearGradient(0, top, 0, cy + radius * 0.2);
        soot.addColorStop(0, rgba(AMBER, 0));
        soot.addColorStop(0.2, rgba([255, 176, 70], 0.7 * gn * bright));
        soot.addColorStop(0.55, rgba([255, 214, 130], 0.9 * gn * bright));
        soot.addColorStop(0.85, rgba([255, 170, 70], 0.3 * gn));
        soot.addColorStop(1, rgba(AMBER, 0));
        ctx.filter = `blur(${Math.round(7 * scale)}px)`;
        ctx.fillStyle = soot;
        ctx.fill(core);
      }

      // the reaction sheet
      ctx.filter = `blur(${(1.2 * scale).toFixed(1)}px)`;
      const sheet = vertical(0.95 * bright, 0.9 * bright);
      ctx.strokeStyle = sheet;
      ctx.lineWidth = 2.4 * scale;
      ctx.stroke(shape);

      // sparks: drift off the sheet at 0 g, rise with the plume at 1 g
      ctx.filter = "none";
      for (const s of sparks) {
        if (!s.alive) continue;
        const k = s.age / s.life;
        const alpha = Math.sin(Math.PI * k) * 0.55 * bright;
        const r = radius * s.dist;
        const x = cx + Math.sin(s.angle) * r * (1 - 0.5 * gn) + gn * Math.sin(t * 3 + s.life * 9) * 6 * scale;
        const rising = gn > 0.5;
        const y = rising ? top + radius * 0.6 - (s.dist - 0.8) * radius * 1.8 : cy - Math.cos(s.angle) * r * (1 + 0.8 * gn);
        ctx.fillStyle = rgba(rising ? [255, 200, 120] : [120, 176, 255], alpha);
        ctx.beginPath();
        ctx.arc(x, y, 1.3 * scale, 0, Math.PI * 2);
        ctx.fill();
      }

      // droplet or wick
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#1a2130";
      ctx.strokeStyle = "rgba(232,236,241,0.4)";
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };

    // Paused: the flame freezes, but frames are still drawn so resizes stay correct.
    let frame = 0;
    let last = performance.now();
    let visible = true;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (visible) {
        if (!target.current.paused) step(dt);
        draw();
      }
      frame = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    io.observe(canvas);
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      io.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" />;
}
