import { Graphics } from "pixi.js";
import { CONFIG } from "./config";

export interface Star {
  active: boolean;
  x: number;
  y: number;
  r: number;
  fall: number;
  baseX: number;
  driftAmp: number;
  driftSpeed: number;
  driftPhase: number;
  twinklePhase: number;
  spin: number;
}

/**
 * Fixed-size pool of falling Sterntaler. One Graphics for all stars — it is
 * redrawn every tick from the active subset.
 */
export class StarPool {
  readonly gfx = new Graphics();
  readonly pool: Star[] = [];
  private timeSinceSpawn = 0;
  private nextSpawnAt = 0;

  constructor(size = CONFIG.stars.poolSize) {
    for (let i = 0; i < size; i++) {
      this.pool.push({
        active: false,
        x: 0,
        y: 0,
        r: 6,
        fall: 25,
        baseX: 0,
        driftAmp: 0,
        driftSpeed: 0,
        driftPhase: 0,
        twinklePhase: 0,
        spin: 0,
      });
    }
    this.nextSpawnAt = rand(CONFIG.stars.spawnEveryMin, CONFIG.stars.spawnEveryMax);
  }

  spawn(width: number): Star | null {
    for (const s of this.pool) {
      if (!s.active) {
        const x = rand(40, width - 40);
        s.active = true;
        s.baseX = x;
        s.x = x;
        s.y = -20 - Math.random() * 40;
        s.r = rand(CONFIG.stars.radiusMin, CONFIG.stars.radiusMax);
        s.fall = rand(CONFIG.stars.fallMin, CONFIG.stars.fallMax);
        s.driftAmp = rand(6, CONFIG.stars.driftAmp);
        s.driftSpeed = rand(CONFIG.stars.driftSpeedMin, CONFIG.stars.driftSpeedMax);
        s.driftPhase = Math.random() * Math.PI * 2;
        s.twinklePhase = Math.random() * Math.PI * 2;
        s.spin = rand(-0.6, 0.6);
        return s;
      }
    }
    return null;
  }

  deactivate(s: Star) {
    s.active = false;
  }

  activeCount(): number {
    let n = 0;
    for (const s of this.pool) if (s.active) n++;
    return n;
  }

  update(dt: number, width: number, height: number, t: number) {
    this.timeSinceSpawn += dt;
    if (this.timeSinceSpawn >= this.nextSpawnAt) {
      this.timeSinceSpawn = 0;
      this.nextSpawnAt = rand(CONFIG.stars.spawnEveryMin, CONFIG.stars.spawnEveryMax);
      this.spawn(width);
    }

    for (const s of this.pool) {
      if (!s.active) continue;
      s.y += s.fall * dt;
      s.x = s.baseX + Math.sin(t * s.driftSpeed + s.driftPhase) * s.driftAmp;
      if (s.y > height + 40) s.active = false;
    }

    this.redraw(t);
  }

  private redraw(t: number) {
    const g = this.gfx;
    g.clear();
    const core = CONFIG.stars.coreColor;
    const halo = CONFIG.stars.haloColor;
    for (const s of this.pool) {
      if (!s.active) continue;
      const tw = 0.75 + 0.25 * Math.sin(t * CONFIG.stars.twinkleSpeed + s.twinklePhase);
      // halo
      g.circle(s.x, s.y, s.r * 2.6).fill({ color: halo, alpha: 0.18 * tw });
      g.circle(s.x, s.y, s.r * 1.6).fill({ color: halo, alpha: 0.35 * tw });
      // five-point star
      drawStar(g, s.x, s.y, s.r, 5, 0.45, CONFIG.stars.color, 0.95);
      // bright core
      g.circle(s.x, s.y, s.r * 0.35).fill({ color: core, alpha: tw });
    }
  }
}

function drawStar(
  g: Graphics,
  cx: number,
  cy: number,
  r: number,
  points: number,
  innerRatio: number,
  color: number,
  alpha: number,
) {
  const step = Math.PI / points;
  let rot = -Math.PI / 2;
  const px: number[] = [];
  const py: number[] = [];
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * innerRatio;
    px.push(cx + Math.cos(rot) * rad);
    py.push(cy + Math.sin(rot) * rad);
    rot += step;
  }
  g.moveTo(px[0], py[0]);
  for (let i = 1; i < px.length; i++) g.lineTo(px[i], py[i]);
  g.closePath().fill({ color, alpha });
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}
