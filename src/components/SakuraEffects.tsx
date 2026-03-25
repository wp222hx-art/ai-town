/**
 * SakuraEffects – Animated particle effects overlaid on the sakura town map.
 *
 * Renders three layers via PIXI ticker:
 *  1. Cherry blossom petals drifting down with gentle sine-wave sway
 *  2. Tiny sparkle / firefly dots that fade in and out
 *  3. Soft light shafts (god-rays) that slowly pulse
 *
 * Uses PixiComponent + ticker for smooth 60fps animation.
 */

import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';

// ---- Petal particle ----
interface Petal {
  x: number;
  y: number;
  size: number;
  speed: number;
  swaySpeed: number;
  rotation: number;
  rotSpeed: number;
  alpha: number;
  color: number;
  phase: number;
}

// ---- Sparkle particle ----
interface Sparkle {
  x: number;
  y: number;
  life: number;
  speed: number;
  maxAlpha: number;
  size: number;
  color: number;
}

// ---- Light shaft ----
interface LightShaft {
  x: number;
  width: number;
  speed: number;
  phase: number;
}

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

const PETAL_COLORS = [0xffb7c5, 0xffc1cc, 0xffd1dc, 0xffe0e8, 0xffffff];
const SPARKLE_COLORS = [0xffffff, 0xfff5e0, 0xffe8f0, 0xeeffee];

function mkPetal(w: number, h: number, top = false): Petal {
  return {
    x: Math.random() * w,
    y: top ? rand(-20, -5) : Math.random() * h,
    size: rand(2, 5),
    speed: rand(0.15, 0.45),
    swaySpeed: rand(0.008, 0.02),
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: rand(-0.02, 0.02),
    alpha: rand(0.25, 0.65),
    color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
    phase: Math.random() * Math.PI * 2,
  };
}

function mkSparkle(w: number, h: number): Sparkle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    life: 0,
    speed: rand(0.004, 0.012),
    maxAlpha: rand(0.35, 0.85),
    size: rand(1, 2.5),
    color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
  };
}

function mkShaft(w: number): LightShaft {
  return {
    x: Math.random() * w,
    width: rand(30, 80),
    speed: rand(0.003, 0.008),
    phase: Math.random() * Math.PI * 2,
  };
}

interface SakuraProps {
  worldWidth: number;
  worldHeight: number;
}

export const SakuraEffects = PixiComponent('SakuraEffects', {
  create: (props: SakuraProps) => {
    const { worldWidth: ww, worldHeight: wh } = props;

    const g = new PIXI.Graphics();

    // Particle pools
    const PETAL_N = 28;
    const SPARKLE_N = 20;
    const SHAFT_N = 3;

    const petals: Petal[] = Array.from({ length: PETAL_N }, () => mkPetal(ww, wh));
    const sparkles: Sparkle[] = Array.from({ length: SPARKLE_N }, () => mkSparkle(ww, wh));
    const shafts: LightShaft[] = Array.from({ length: SHAFT_N }, () => mkShaft(ww));

    let frame = 0;

    // Ticker callback – runs every frame
    const tick = () => {
      g.clear();
      frame++;

      // ---- Light shafts (behind everything) ----
      for (const s of shafts) {
        s.phase += s.speed;
        const a = (Math.sin(s.phase) * 0.5 + 0.5) * 0.045;
        if (a > 0.005) {
          g.beginFill(0xfff8f0, a);
          g.moveTo(s.x - s.width * 0.3, 0);
          g.lineTo(s.x + s.width * 0.3, 0);
          g.lineTo(s.x + s.width, wh);
          g.lineTo(s.x - s.width, wh);
          g.closePath();
          g.endFill();
        }
      }

      // ---- Cherry blossom petals ----
      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        p.y += p.speed;
        p.x += Math.sin(frame * p.swaySpeed + p.phase) * 0.5;
        p.rotation += p.rotSpeed;

        if (p.y > wh + 12) {
          petals[i] = mkPetal(ww, wh, true);
          continue;
        }

        // Petal body (ellipse)
        g.beginFill(p.color, p.alpha);
        g.drawEllipse(p.x, p.y, p.size * 1.4, p.size * 0.7);
        g.endFill();

        // Inner highlight dot
        g.beginFill(0xffffff, p.alpha * 0.35);
        g.drawCircle(p.x - p.size * 0.3, p.y - p.size * 0.2, p.size * 0.3);
        g.endFill();
      }

      // ---- Sparkles ----
      for (let i = 0; i < sparkles.length; i++) {
        const s = sparkles[i];
        s.life += s.speed;
        if (s.life >= 1) {
          sparkles[i] = mkSparkle(ww, wh);
          continue;
        }
        const fade = s.life < 0.3 ? s.life / 0.3 : s.life > 0.7 ? (1 - s.life) / 0.3 : 1;
        const alpha = fade * s.maxAlpha;
        if (alpha > 0.01) {
          // Center dot
          g.beginFill(s.color, alpha);
          g.drawCircle(s.x, s.y, s.size);
          g.endFill();
          // Cross-hair arms
          g.beginFill(s.color, alpha * 0.45);
          g.drawRect(s.x - s.size * 2, s.y - 0.4, s.size * 4, 0.8);
          g.drawRect(s.x - 0.4, s.y - s.size * 2, 0.8, s.size * 4);
          g.endFill();
        }
      }
    };

    // Attach to global ticker
    PIXI.Ticker.shared.add(tick);

    // Store cleanup ref on the graphics object
    (g as any).__sakuraTick = tick;

    return g;
  },

  applyProps: (instance, oldProps, newProps) => {
    applyDefaultProps(instance, oldProps, newProps);
  },

  willUnmount: (instance) => {
    const tick = (instance as any).__sakuraTick;
    if (tick) {
      PIXI.Ticker.shared.remove(tick);
    }
  },
});
