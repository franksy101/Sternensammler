import { Container, Graphics } from "pixi.js";
import { CONFIG } from "./config";

/**
 * Scenes render into a Container with a Graphics target so the director
 * can crossfade them by tweaking the container's alpha. Each scene is a
 * stateless function of (t, width, height) except for the tiny per-scene
 * parallax state carried on the scene object itself.
 */
export type SceneId = "DUSK" | "NIGHT" | "COSMIC" | "SPHERE";

interface SceneState {
  id: SceneId;
  container: Container;
  gfx: Graphics;
  starfield: Graphics;
  starSeeds: { x: number; y: number; r: number; tw: number }[];
  planetSeeds: { x: number; y: number; r: number; c: number; ring: boolean }[];
}

export class SceneDirector {
  readonly root = new Container();
  private cur: SceneState;
  private next: SceneState | null = null;
  private crossfade = 0; // 0..1 while `next` is present
  private elapsed = 0;
  private cycleCount = 0;

  constructor(
    private width: number,
    private height: number,
    startIndex = 0,
  ) {
    const order: SceneId[] = ["DUSK", "NIGHT", "COSMIC"];
    const id = order[startIndex % order.length];
    this.cur = buildScene(id, width, height);
    this.cur.container.alpha = 1;
    this.root.addChild(this.cur.container);
  }

  currentId(): SceneId {
    return this.cur.id;
  }

  advance(): SceneId {
    this.cycleCount += 1;
    const order: SceneId[] = ["DUSK", "NIGHT", "COSMIC"];
    let nextId: SceneId;
    if (this.cycleCount % CONFIG.scene.sphereEvery === 0) nextId = "SPHERE";
    else {
      // skip around so the same scene doesn't repeat back-to-back
      const curIdx = order.indexOf(this.cur.id);
      nextId = order[(curIdx + 1 + Math.floor(Math.random() * 2)) % order.length];
      if (nextId === this.cur.id) nextId = order[(curIdx + 1) % order.length];
    }
    this.next = buildScene(nextId, this.width, this.height);
    this.next.container.alpha = 0;
    this.root.addChild(this.next.container);
    this.crossfade = 0;
    return nextId;
  }

  update(dt: number, t: number) {
    this.elapsed += dt;
    if (this.next) {
      this.crossfade += dt / CONFIG.scene.crossfadeSeconds;
      if (this.crossfade >= 1) {
        this.root.removeChild(this.cur.container);
        this.cur.container.destroy();
        this.cur = this.next;
        this.cur.container.alpha = 1;
        this.next = null;
        this.elapsed = 0;
      } else {
        this.cur.container.alpha = 1 - this.crossfade;
        this.next.container.alpha = this.crossfade;
      }
    } else if (
      this.elapsed >=
      CONFIG.scene.minDuration +
        Math.random() * (CONFIG.scene.maxDuration - CONFIG.scene.minDuration)
    ) {
      this.advance();
    }

    renderScene(this.cur, this.width, this.height, t);
    if (this.next) renderScene(this.next, this.width, this.height, t);
  }
}

function buildScene(id: SceneId, width: number, height: number): SceneState {
  const container = new Container();
  const gfx = new Graphics();
  const starfield = new Graphics();
  container.addChild(gfx);
  container.addChild(starfield);

  // Pre-seeded random positions so scenes don't jitter each frame.
  const starSeeds = [] as SceneState["starSeeds"];
  const count = id === "DUSK" ? 40 : id === "COSMIC" ? 140 : id === "SPHERE" ? 180 : 110;
  for (let i = 0; i < count; i++) {
    starSeeds.push({
      x: Math.random() * width,
      y: Math.random() * height * (id === "DUSK" ? 0.55 : 1),
      r: 0.4 + Math.random() * 1.3,
      tw: Math.random() * Math.PI * 2,
    });
  }

  const planetSeeds: SceneState["planetSeeds"] = [];
  if (id === "COSMIC") {
    const P = CONFIG.palettes.cosmic;
    planetSeeds.push({ x: width * 0.2, y: height * 0.28, r: 42, c: P.planetA, ring: false });
    planetSeeds.push({ x: width * 0.78, y: height * 0.42, r: 60, c: P.planetB, ring: true });
    planetSeeds.push({ x: width * 0.55, y: height * 0.18, r: 18, c: P.planetC, ring: false });
  }
  if (id === "NIGHT") {
    planetSeeds.push({ x: width * 0.75, y: height * 0.22, r: 48, c: CONFIG.palettes.night.moon, ring: false });
  }

  return { id, container, gfx, starfield, starSeeds, planetSeeds };
}

function renderScene(s: SceneState, width: number, height: number, t: number) {
  const g = s.gfx;
  g.clear();
  const sf = s.starfield;
  sf.clear();

  switch (s.id) {
    case "DUSK":
      renderDusk(g, sf, s, width, height, t);
      break;
    case "NIGHT":
      renderNight(g, sf, s, width, height, t);
      break;
    case "COSMIC":
      renderCosmic(g, sf, s, width, height, t);
      break;
    case "SPHERE":
      renderSphere(g, sf, s, width, height, t);
      break;
  }
}

/** Multi-band vertical gradient — faster than one rect per pixel. */
function verticalGradient(
  g: Graphics,
  width: number,
  height: number,
  stops: [number, number][], // [t0..1, colorHex]
) {
  const bands = 30;
  for (let i = 0; i < bands; i++) {
    const y0 = (i / bands) * height;
    const y1 = ((i + 1) / bands) * height;
    const u = (i + 0.5) / bands;
    const col = lerpStops(stops, u);
    g.rect(0, y0, width, y1 - y0 + 1).fill({ color: col });
  }
}

function lerpStops(stops: [number, number][], u: number): number {
  for (let i = 1; i < stops.length; i++) {
    if (u <= stops[i][0]) {
      const [ta, ca] = stops[i - 1];
      const [tb, cb] = stops[i];
      const k = (u - ta) / Math.max(0.0001, tb - ta);
      return lerpColor(ca, cb, k);
    }
  }
  return stops[stops.length - 1][1];
}

function lerpColor(a: number, b: number, k: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * k);
  const gg = Math.round(ag + (bg - ag) * k);
  const bl = Math.round(ab + (bb - ab) * k);
  return (r << 16) | (gg << 8) | bl;
}

function drawFaintStars(sf: Graphics, seeds: SceneState["starSeeds"], t: number, color: number, maxAlpha = 0.9) {
  for (const s of seeds) {
    const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.2 + s.tw));
    sf.circle(s.x, s.y, s.r).fill({ color, alpha: a * maxAlpha });
  }
}

/** DUSK — warm horizon, low sun, few early stars */
function renderDusk(g: Graphics, sf: Graphics, s: SceneState, w: number, h: number, t: number) {
  const P = CONFIG.palettes.dusk;
  verticalGradient(g, w, h, [
    [0.0, P.top],
    [0.55, P.mid],
    [0.8, P.horizon],
    [1.0, 0x2a1b2e],
  ]);

  // distant mountains
  const mx = w;
  const my = h * 0.75;
  g.moveTo(0, my);
  const peaks = 9;
  for (let i = 0; i <= peaks; i++) {
    const x = (i / peaks) * mx;
    const y = my - 20 - Math.sin(i * 1.2 + 0.3) * 10 - (i % 2) * 14;
    g.lineTo(x, y);
  }
  g.lineTo(mx, h).lineTo(0, h).closePath().fill({ color: 0x2d2140, alpha: 0.85 });

  // sun
  const sx = w * (0.32 + 0.02 * Math.sin(t * 0.05));
  const sy = h * 0.72;
  g.circle(sx, sy, 70).fill({ color: P.sunHalo, alpha: 0.3 });
  g.circle(sx, sy, 48).fill({ color: P.sunHalo, alpha: 0.55 });
  g.circle(sx, sy, 32).fill({ color: P.sunCore });

  // faint early stars (only high up)
  const upper = s.starSeeds.filter((ss) => ss.y < h * 0.45);
  drawFaintStars(sf, upper, t, P.star, 0.75);
}

/** NIGHT — deep blue, moon, lots of stars */
function renderNight(g: Graphics, sf: Graphics, s: SceneState, w: number, h: number, t: number) {
  const P = CONFIG.palettes.night;
  verticalGradient(g, w, h, [
    [0.0, P.top],
    [0.6, P.mid],
    [1.0, P.horizon],
  ]);
  // moon
  for (const p of s.planetSeeds) {
    g.circle(p.x, p.y, p.r * 1.6).fill({ color: p.c, alpha: 0.08 });
    g.circle(p.x, p.y, p.r * 1.2).fill({ color: p.c, alpha: 0.18 });
    g.circle(p.x, p.y, p.r).fill({ color: p.c });
    // craters
    g.circle(p.x - p.r * 0.3, p.y - p.r * 0.15, p.r * 0.14).fill({ color: 0xc7bfe0, alpha: 0.6 });
    g.circle(p.x + p.r * 0.25, p.y + p.r * 0.25, p.r * 0.1).fill({ color: 0xc7bfe0, alpha: 0.5 });
  }
  // horizon haze
  g.rect(0, h * 0.78, w, h * 0.22).fill({ color: 0x272f66, alpha: 0.5 });
  drawFaintStars(sf, s.starSeeds, t, P.star, 1);
}

/** COSMIC — nebula bands, multiple planets */
function renderCosmic(g: Graphics, sf: Graphics, s: SceneState, w: number, h: number, t: number) {
  const P = CONFIG.palettes.cosmic;
  verticalGradient(g, w, h, [
    [0.0, P.top],
    [0.5, P.mid],
    [1.0, P.horizon],
  ]);
  // nebula bands
  const bands = 4;
  for (let i = 0; i < bands; i++) {
    const cy = h * (0.2 + i * 0.2) + Math.sin(t * 0.08 + i) * 6;
    g.ellipse(w * (0.3 + i * 0.2), cy, w * 0.6, 60 + i * 10)
      .fill({ color: i % 2 === 0 ? P.planetA : P.planetC, alpha: 0.09 });
  }
  // planets
  for (const p of s.planetSeeds) {
    g.circle(p.x, p.y, p.r * 1.5).fill({ color: p.c, alpha: 0.12 });
    g.circle(p.x, p.y, p.r).fill({ color: p.c });
    // terminator shadow
    g.circle(p.x + p.r * 0.35, p.y + p.r * 0.15, p.r * 0.95).fill({ color: 0x000020, alpha: 0.35 });
    if (p.ring) {
      g.ellipse(p.x, p.y, p.r * 1.9, p.r * 0.35).stroke({ color: 0xffe9b0, width: 2, alpha: 0.7 });
      g.ellipse(p.x, p.y, p.r * 1.6, p.r * 0.25).stroke({ color: 0xffe9b0, width: 1, alpha: 0.5 });
    }
  }
  drawFaintStars(sf, s.starSeeds, t, P.star, 1);
}

/** SPHERE — the surprise: horizon curls into a small planet beneath */
function renderSphere(g: Graphics, sf: Graphics, s: SceneState, w: number, h: number, t: number) {
  const P = CONFIG.palettes.sphere;
  // deep space backdrop
  g.rect(0, 0, w, h).fill({ color: P.space });
  drawFaintStars(sf, s.starSeeds, t, P.star, 1);

  // the small planet near the bottom — the "ground" curls into view
  const cx = w / 2 + Math.sin(t * 0.1) * 12;
  const cy = h + 80;
  const r = h * 0.95;
  // atmosphere glow
  g.circle(cx, cy, r * 1.06).fill({ color: P.planetAtmos, alpha: 0.2 });
  g.circle(cx, cy, r * 1.03).fill({ color: P.planetAtmos, alpha: 0.35 });
  // planet body
  g.circle(cx, cy, r).fill({ color: P.planet });
  // lighter terminator
  g.circle(cx - r * 0.25, cy - r * 0.15, r * 0.9).fill({ color: P.planetHi, alpha: 0.35 });
  // surface patches
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + t * 0.03;
    const rr = r * 0.88;
    const x = cx + Math.cos(a) * rr * 0.7;
    const y = cy - Math.sin(a) * rr * 0.5;
    g.ellipse(x, y, 40 + (i % 3) * 10, 8).fill({ color: 0x2a3778, alpha: 0.4 });
  }
  // horizon glow
  g.circle(cx, cy, r + 2).stroke({ color: P.horizon, width: 2, alpha: 0.8 });
}
