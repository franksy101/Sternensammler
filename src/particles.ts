import { Graphics } from "pixi.js";
import { CONFIG } from "./config";

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  r: number;
  color: number;
  kind: "spark" | "ring" | "dust";
}

/**
 * One Graphics for all particles. Pool is fixed-size; spawn() returns false
 * when the pool is full (caller may skip quietly).
 */
export class ParticleSystem {
  readonly gfx = new Graphics();
  private readonly pool: Particle[] = [];

  constructor(size = CONFIG.particles.poolSize) {
    for (let i = 0; i < size; i++) {
      this.pool.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        r: 1,
        color: 0xffffff,
        kind: "spark",
      });
    }
  }

  spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    opts?: { color?: number; life?: number; r?: number; kind?: Particle["kind"] },
  ): boolean {
    for (const p of this.pool) {
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = vx;
        p.vy = vy;
        const maxLife =
          opts?.life ??
          CONFIG.particles.lifeMin +
            Math.random() * (CONFIG.particles.lifeMax - CONFIG.particles.lifeMin);
        p.life = maxLife;
        p.maxLife = maxLife;
        p.r = opts?.r ?? 2 + Math.random() * 2;
        p.color = opts?.color ?? 0xffeaa8;
        p.kind = opts?.kind ?? "spark";
        return true;
      }
    }
    return false;
  }

  burst(x: number, y: number, count: number, color?: number, speed = 100) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.5 + Math.random());
      this.spawn(x, y, Math.cos(a) * v, Math.sin(a) * v, {
        color,
        life: 0.9 + Math.random() * 0.8,
        r: 2 + Math.random() * 2.5,
        kind: "spark",
      });
    }
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // gentle drag so bursts settle
      p.vx *= 1 - 0.8 * dt;
      p.vy *= 1 - 0.6 * dt;
      // slow upward drift for dust, slow downward for sparks
      if (p.kind === "dust") p.vy -= 10 * dt;
      else p.vy += 20 * dt;
    }
    this.redraw();
  }

  private redraw() {
    const g = this.gfx;
    g.clear();
    for (const p of this.pool) {
      if (!p.active) continue;
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));
      const r = p.r * (0.6 + 0.4 * a);
      if (p.kind === "ring") {
        g.circle(p.x, p.y, r)
          .stroke({ color: p.color, width: 1.2, alpha: a * 0.8 });
      } else {
        g.circle(p.x, p.y, r).fill({ color: p.color, alpha: a });
      }
    }
  }

  clear() {
    for (const p of this.pool) p.active = false;
    this.gfx.clear();
  }
}
