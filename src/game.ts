import { Application, Container, Graphics } from "pixi.js";
import { BloomFilter } from "pixi-filters";
import { CONFIG } from "./config";
import { Input } from "./input";
import { installTouchControls } from "./touchControls";
import { StarPool } from "./stars";
import { Basket } from "./basket";
import { ParticleSystem } from "./particles";
import { SceneDirector } from "./scenes";
import { Hud } from "./hud";
import { loadState, saveState, type PersistedState } from "./storage";
import { chime, ensureCtx, isMuted, scatterShimmer, setMuted, setPadIntensity } from "./audio";
import { installResponsive } from "./responsive";

type State = "TITLE" | "COLLECTING" | "PAUSED" | "SCATTERING" | "DREAM";

export class Game {
  readonly app = new Application();
  private world = new Container();
  private uiLayer = new Container();
  private stars!: StarPool;
  private basket!: Basket;
  private particles!: ParticleSystem;
  private scenes!: SceneDirector;
  private hud!: Hud;
  private fireflies = new Graphics();
  private fireflyCount = 0; // appears after scatters
  private pausedVeil = new Graphics();
  private dreamVeil = new Graphics();

  private state: State = "TITLE";
  private stateT = 0; // seconds in current state
  private idle = 0; // seconds since last catch
  private time = 0; // seconds since init
  private scatterT = 0;

  private persisted: PersistedState = loadState();

  async init(parent: HTMLElement) {
    await this.app.init({
      width: CONFIG.width,
      height: CONFIG.height,
      background: 0x050416,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });

    parent.appendChild(this.app.canvas);
    installResponsive(this.app.canvas);

    // Filter on the world layer only; HUD stays crisp.
    try {
      const bloom = new BloomFilter({ strength: 6, quality: 4 });
      this.world.filters = [bloom];
    } catch (err) {
      console.warn("Bloom filter unavailable; continuing without it.", err);
    }

    this.scenes = new SceneDirector(CONFIG.width, CONFIG.height, this.persisted.lastSceneIndex);
    this.stars = new StarPool();
    this.particles = new ParticleSystem();
    this.basket = new Basket(CONFIG.width, CONFIG.height);
    this.hud = new Hud(CONFIG.width, CONFIG.height);

    this.world.addChild(this.scenes.root);
    this.world.addChild(this.stars.gfx);
    this.world.addChild(this.fireflies);
    this.world.addChild(this.basket.gfx);
    this.world.addChild(this.particles.gfx);

    this.uiLayer.addChild(this.pausedVeil);
    this.uiLayer.addChild(this.dreamVeil);
    this.uiLayer.addChild(this.hud.root);

    this.app.stage.addChild(this.world);
    this.app.stage.addChild(this.uiLayer);

    // Global input
    Input.install(window);
    installTouchControls({ canvas: this.app.canvas });

    window.addEventListener(
      "keydown",
      (e) => {
        if (
          e.code === "ArrowLeft" ||
          e.code === "ArrowRight" ||
          e.code === "ArrowUp" ||
          e.code === "ArrowDown" ||
          e.code === "Space"
        ) {
          e.preventDefault();
        }
      },
      { passive: false },
    );

    // Unlock audio on first gesture
    const unlock = () => {
      ensureCtx();
      setMuted(this.persisted.muted);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    this.fireflyCount = Math.min(3, Math.max(0, this.persisted.totalScatters));

    this.setState("COLLECTING");

    this.app.ticker.add(() => {
      const dt = Math.min(1 / 30, this.app.ticker.deltaMS / 1000);
      this.tick(dt);
    });
  }

  private setState(next: State) {
    this.state = next;
    this.stateT = 0;
    if (next === "SCATTERING") {
      this.scatterT = 0;
      scatterShimmer();
      this.hud.showToast("Ausgestreut in die Welt.");
      this.particles.burst(this.basket.x, this.basket.y - 10, 80, 0xfff0c2, CONFIG.scatter.outwardSpeed);
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2;
        this.particles.spawn(
          this.basket.x,
          this.basket.y - 10,
          Math.cos(a) * 60,
          Math.sin(a) * 60,
          { color: 0xffe7a1, r: 3.5, life: CONFIG.scatter.duration, kind: "ring" },
        );
      }
    }
    if (next === "COLLECTING") {
      setPadIntensity(0.3);
    }
    if (next === "DREAM") {
      setPadIntensity(0);
      this.hud.showToast("Schlaf gut.");
    }
  }

  private tick(dt: number) {
    this.time += dt;
    this.stateT += dt;

    // Pause / mute toggles
    if (Input.pressed("KeyP")) {
      if (this.state === "COLLECTING") this.setState("PAUSED");
      else if (this.state === "PAUSED") this.setState("COLLECTING");
    }
    if (Input.pressed("KeyM")) {
      this.persisted.muted = !this.persisted.muted;
      setMuted(this.persisted.muted);
      saveState(this.persisted);
    }

    // Wake from DREAM
    if (this.state === "DREAM") {
      if (Input.pressed("Space") || Input.pressed("Enter") || Input.steerAxis() !== 0 || Input.pressed("KeyP")) {
        this.setState("COLLECTING");
      }
    }

    this.scenes.update(this.state === "PAUSED" ? 0 : dt, this.time);

    if (this.state === "COLLECTING") {
      this.updateCollecting(dt);
    } else if (this.state === "SCATTERING") {
      this.updateScattering(dt);
    } else if (this.state === "PAUSED") {
      // freeze — particles and stars keep their positions
    } else if (this.state === "DREAM") {
      this.particles.update(dt * 0.4);
    }

    // Visual overlays
    this.renderPauseVeil(this.state === "PAUSED");
    this.renderDreamVeil(this.state === "DREAM", this.stateT);

    // HUD (always updates so text eases out)
    this.hud.update(dt, this.basket.fillFraction(), isMuted(), this.persisted.totalScatters);

    this.updateFireflies(dt);

    Input.endFrame();
  }

  private updateCollecting(dt: number) {
    this.idle += dt;
    this.stars.update(dt, CONFIG.width, CONFIG.height, this.time);
    this.basket.update(dt, CONFIG.width, Input.keyAxis(), isTouchActive(), touchAxisValue());
    this.particles.update(dt);

    // Collision
    for (const s of this.stars.pool) {
      if (!s.active) continue;
      if (this.basket.catches(s)) {
        this.stars.deactivate(s);
        this.basket.fill += 1;
        this.idle = 0;
        chime();
        this.particles.burst(s.x, s.y, 6, 0xffe7a1, 70);
        this.particles.spawn(s.x, s.y, 0, -30, {
          color: 0xfff7d4,
          r: 3,
          life: 0.8,
          kind: "ring",
        });
      }
    }

    if (this.basket.isFull()) {
      this.performScatter();
    } else if (
      Input.pressed("Space") ||
      Input.pressed("Enter")
    ) {
      if (this.basket.fillFraction() >= CONFIG.scatter.minFillFraction) {
        this.performScatter();
      }
    }

    if (this.idle >= CONFIG.dream.idleSeconds) {
      this.setState("DREAM");
    }
  }

  private performScatter() {
    this.setState("SCATTERING");
    this.persisted.totalScatters += 1;
    this.fireflyCount = Math.min(3, this.persisted.totalScatters);
    this.persisted.lastSceneIndex = (this.persisted.lastSceneIndex + 1) % 3;
    saveState(this.persisted);
  }

  private updateScattering(dt: number) {
    this.scatterT += dt;
    this.particles.update(dt);
    // Stars keep falling in the background, slower
    this.stars.update(dt * 0.7, CONFIG.width, CONFIG.height, this.time);

    // periodic secondary bursts across the sky as the ritual unfolds
    if (Math.random() < dt * 4) {
      const x = Math.random() * CONFIG.width;
      const y = Math.random() * CONFIG.height * 0.8;
      this.particles.burst(x, y, 8, 0xffe7a1, 40);
      if (Math.random() < 0.35) chime(Math.floor(Math.random() * 8));
    }

    if (this.scatterT >= CONFIG.scatter.duration) {
      this.basket.reset();
      this.scenes.advance();
      this.setState("COLLECTING");
    }
  }

  private renderPauseVeil(visible: boolean) {
    const g = this.pausedVeil;
    g.clear();
    if (!visible) return;
    g.rect(0, 0, CONFIG.width, CONFIG.height).fill({ color: 0x000020, alpha: 0.35 });
    // breathing "Pause" text drawn as a soft circle so it stays visual, not noisy
    const r = 30 + Math.sin(this.stateT * 1.3) * 2;
    g.circle(CONFIG.width / 2, CONFIG.height / 2, r + 6).stroke({ color: 0xdadaff, width: 1, alpha: 0.4 });
    g.circle(CONFIG.width / 2, CONFIG.height / 2, r).stroke({ color: 0xdadaff, width: 2, alpha: 0.8 });
  }

  private renderDreamVeil(visible: boolean, stateT: number) {
    const g = this.dreamVeil;
    g.clear();
    if (!visible) return;
    const a = Math.min(0.85, stateT / CONFIG.dream.fadeSeconds);
    g.rect(0, 0, CONFIG.width, CONFIG.height).fill({ color: 0x000010, alpha: a });
  }

  private updateFireflies(dt: number) {
    const g = this.fireflies;
    g.clear();
    if (this.fireflyCount <= 0) return;
    const baseX = this.basket.x;
    const baseY = this.basket.y - 60;
    for (let i = 0; i < this.fireflyCount; i++) {
      const phase = (i / this.fireflyCount) * Math.PI * 2;
      const fx = baseX + Math.cos(this.time * 0.7 + phase) * (40 + i * 12);
      const fy = baseY + Math.sin(this.time * 0.9 + phase * 1.3) * (18 + i * 6) - i * 10;
      const glow = 0.6 + 0.4 * Math.sin(this.time * 4 + phase);
      g.circle(fx, fy, 9).fill({ color: 0xfff3a1, alpha: 0.1 * glow });
      g.circle(fx, fy, 5).fill({ color: 0xfff3a1, alpha: 0.35 * glow });
      g.circle(fx, fy, 2).fill({ color: 0xffffff, alpha: 0.9 * glow });
    }
  }
}

// Helpers to read touch axis without exposing internals of Input
function isTouchActive(): boolean {
  // reuse merged axis: if keyAxis is 0 but steerAxis isn't, touch is active
  return Input.keyAxis() === 0 && Input.steerAxis() !== 0;
}
function touchAxisValue(): number {
  // if keyAxis is non-zero, fall back to it so the basket follows key input;
  // otherwise steerAxis equals the raw touch axis value.
  return Input.keyAxis() !== 0 ? 0 : Input.steerAxis();
}
