import { Graphics } from "pixi.js";
import { CONFIG } from "./config";
import type { Star } from "./stars";

/**
 * The woven basket. Graphics are redrawn only when `dirty` is set.
 * The fill visual (stars piling inside) is handled by the ParticleSystem,
 * not by redrawing the weave each frame.
 */
export class Basket {
  readonly gfx = new Graphics();
  x: number;
  y: number;
  targetX: number;
  fill = 0;
  dirty = true;
  private lastFill = -1;

  constructor(stageWidth: number, stageHeight: number) {
    this.x = stageWidth / 2;
    this.targetX = this.x;
    this.y = stageHeight - CONFIG.basket.yMargin - CONFIG.basket.height / 2;
    this.render();
  }

  get width() {
    return CONFIG.basket.width;
  }

  get height() {
    return CONFIG.basket.height;
  }

  get capacity() {
    return CONFIG.basket.capacity;
  }

  isFull(): boolean {
    return this.fill >= this.capacity;
  }

  fillFraction(): number {
    return Math.max(0, Math.min(1, this.fill / this.capacity));
  }

  reset() {
    this.fill = 0;
    this.dirty = true;
  }

  /** Returns true if this star is now caught. */
  catches(s: Star): boolean {
    if (!s.active) return false;
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    // Catch only once the star has entered the basket's upper-mouth band.
    if (s.y < this.y - halfH * 0.4) return false;
    if (s.y > this.y + halfH * 0.6) return false;
    if (s.x < this.x - halfW * 0.8) return false;
    if (s.x > this.x + halfW * 0.8) return false;
    return true;
  }

  update(dt: number, stageWidth: number, keyAxis: number, touchActive: boolean, touchAxis: number) {
    const halfW = this.width / 2;
    if (touchActive) {
      // map touch axis to target x across the playfield
      this.targetX = stageWidth / 2 + touchAxis * (stageWidth / 2 - halfW - 20);
    } else if (keyAxis !== 0) {
      // arrow-keys nudge the target
      this.targetX += keyAxis * CONFIG.basket.speed * dt;
    } else {
      // no input → keep drifting toward last target (no snap-back)
    }
    this.targetX = Math.max(halfW + 8, Math.min(stageWidth - halfW - 8, this.targetX));

    const dx = this.targetX - this.x;
    this.x += dx * CONFIG.basket.easeToTouch * (60 * dt);

    if (Math.round(this.fillFraction() * 10) !== this.lastFill) {
      this.dirty = true;
      this.lastFill = Math.round(this.fillFraction() * 10);
    }

    if (this.dirty) {
      this.render();
      this.dirty = false;
    }
    this.gfx.position.set(this.x, this.y);
  }

  private render() {
    const g = this.gfx;
    g.clear();
    const w = this.width;
    const h = this.height;
    const hw = w / 2;
    const hh = h / 2;
    const rim = CONFIG.basket.rimColor;
    const weave = CONFIG.basket.weaveColor;
    const body = CONFIG.basket.color;
    const f = this.fillFraction();

    // soft ground shadow
    g.ellipse(0, hh + 10, hw * 0.85, 6).fill({ color: 0x000000, alpha: 0.28 });

    // basket body (trapezoid-ish)
    const topL = -hw * 0.95;
    const topR = hw * 0.95;
    const botL = -hw * 0.72;
    const botR = hw * 0.72;
    g.moveTo(topL, -hh * 0.2)
      .lineTo(topR, -hh * 0.2)
      .lineTo(botR, hh)
      .lineTo(botL, hh)
      .closePath()
      .fill({ color: body });

    // weave bands — subtle vertical lines
    for (let i = -4; i <= 4; i++) {
      const tx = i * (hw * 0.95 / 4);
      const bx = i * (hw * 0.72 / 4);
      g.moveTo(tx, -hh * 0.2).lineTo(bx, hh).stroke({ color: weave, width: 1.2, alpha: 0.35 });
    }
    // weave horizontal lines
    for (let k = 0; k < 5; k++) {
      const y = -hh * 0.2 + (k / 4) * (hh + hh * 0.2);
      const lerp = k / 4;
      const lx = topL * (1 - lerp) + botL * lerp;
      const rx = topR * (1 - lerp) + botR * lerp;
      g.moveTo(lx, y).lineTo(rx, y).stroke({ color: weave, width: 1, alpha: 0.25 });
    }

    // rim (top ellipse)
    g.ellipse(0, -hh * 0.2, hw * 0.95, hh * 0.22).fill({ color: rim });
    g.ellipse(0, -hh * 0.2, hw * 0.95, hh * 0.22).stroke({ color: 0x6b4726, width: 2 });

    // filling glow — star mound inside the rim
    if (f > 0) {
      const glowR = hw * 0.85 * Math.min(1, 0.4 + f * 0.7);
      const glowH = hh * 0.22 * Math.min(1, 0.4 + f * 0.7);
      g.ellipse(0, -hh * 0.2, glowR, glowH).fill({ color: CONFIG.basket.fillGlow, alpha: 0.25 + 0.35 * f });
      g.ellipse(0, -hh * 0.2, glowR * 0.55, glowH * 0.55).fill({ color: 0xffffff, alpha: 0.15 + 0.25 * f });
    }

    // handle arcs on each side of the rim
    g.moveTo(-hw * 0.95, -hh * 0.2)
      .bezierCurveTo(-hw * 1.1, -hh * 0.9, -hw * 0.4, -hh * 1.1, 0, -hh * 1.05)
      .bezierCurveTo(hw * 0.4, -hh * 1.1, hw * 1.1, -hh * 0.9, hw * 0.95, -hh * 0.2)
      .stroke({ color: rim, width: 4, alpha: 0.9 });
  }
}
