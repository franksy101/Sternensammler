# CLAUDE.md

This file provides guidance to Claude Code (<claude.ai/code>) when working with code in this repository.

## What this is

**Sternensammler** — a calming, meditative browser game. The player moves a woven basket along the horizon and catches slow-falling *Sterntaler* (star coins, from the Brothers Grimm fairy tale). When the basket fills, the collected stars are scattered back into the world. The design goal is not challenge but sleep — pacing, audio and visuals are tuned to soothe. Desktop (mouse + keyboard) and mobile (touch) are both first-class.

## Commands

```bash
npm install
npm run dev      # Vite dev server on :5173 (root is dev/, not the repo root)
npm run build    # tsc --noEmit type-check, then Vite builds into docs/
npm run preview  # serve the built docs/ locally
```

There is no linter and no test runner. `tsc` in `npm run build` is the only static check; `tsconfig.json` is `strict` with `noEmit`.

## Repository layout quirks (read before editing paths)

- `vite.config.ts` sets `root: "dev"`, so Vite's entry HTML is `dev/index.html`, which in turn loads `../src/main.ts`. The top-level `index.html` is **not** the dev entry — it is a static redirect to `./docs/` so the bare GitHub Pages URL works.
- `npm run build` writes into `docs/` with `emptyOutDir: true`. **`docs/` is committed** — GitHub Pages serves it directly. If you change anything under `src/` that should ship, rebuild and commit the regenerated `docs/` alongside your source changes. `base: "./"` keeps the bundle path-agnostic.
- `.github/workflows/deploy.yml` also runs `npm run build` on push to `main` or `claude/star-collector-game-r2bp1` and uploads `docs/` via `actions/deploy-pages@v4`. Pages can be configured either to serve the committed `docs/` folder or to use this workflow — both paths are supported.

## Architecture

Single-canvas Pixi.js v8 game, no asset pipeline — all graphics are drawn with `Graphics`, all sounds are synthesized in `src/audio.ts` with the Web Audio API.

### Composition root: `src/game.ts`

`Game` owns the Pixi `Application` and a small finite state machine:

```
TITLE → COLLECTING ⇄ PAUSED → SCATTERING → COLLECTING …
                                         ↳ DREAM (long-idle fade)
```

There is no "game over" state by design — the loop is intentionally endless. `COLLECTING` is the only path that falls stars, advances the basket, resolves catches, and checks whether the basket is full. When it is, the game transitions to `SCATTERING`, a non-interactive ritual where the collected stars bloom outward across the sky; control returns to `COLLECTING` once the ritual ends. `DREAM` is reached after a long idle (no catches for `CONFIG.dream.idleSeconds`) and slowly fades the scene toward black with the ambient pad held at a low drone. A tap or key wakes it back into `COLLECTING`.

Each tick (`Game.tick`) runs the shared update (scene crossfade, starfield, particles) and then switches on `state`. Delta-time is clamped to `1/30` to avoid tunneling after a stall.

### Scene graph / filter pipeline

The render tree has two layers under one `root` container:

- `world` — scene backdrop (gradient, stars, planets, moons, occasional spherical horizon), falling Sterntaler, basket, particles, drifting "surprises" (comet, cloud-whale, paper-boat moon).
- `uiLayer` — unobtrusive HUD (basket fill meter, soft hint text) and overlay screens.

A `BloomFilter` is applied to `world` for the dreamy glow; `uiLayer` is unfiltered so text stays crisp. The filter construction is wrapped in try/catch in `Game.init`. If the GPU refuses a shader, the game continues without it. `src/main.ts` also installs top-level `error` and `unhandledrejection` handlers that render a visible overlay so init failures are obvious instead of a black screen.

There is no screen shake — this game never shakes.

### Scenes and the dreamscape: `src/scenes.ts`

The background is a finite list of hand-tuned **scenes** (`DUSK`, `NIGHT`, `COSMIC`, `SPHERE`) with a `render(ctx, t)` method and a palette. `SceneDirector` holds a current and an optional next scene and crossfades `alpha` over `CONFIG.scene.crossfadeSeconds`. Scene changes are driven by a slow, non-random cycle (minimum duration in `CONFIG`) so the player can sense a rhythm. `SPHERE` is the "surprise" scene — the horizon curls into a small planet and the parallax flips; schedule it sparingly (roughly 1 in 6 cycles).

Don't read `Date.now()` inside a scene; use the `t` parameter so crossfades line up.

### Performance-critical patterns (do not break these)

- **Object pools, not allocations.** `StarPool(120)` (Sterntaler) and `ParticleSystem(600)` are fixed-size pools with an `active` flag. `stars.spawn` returns `null` when the pool is full; callers must handle that gracefully (the sky just gets a bit less busy). No `new` in the hot loop.
- **One `Graphics` per system, redrawn each frame.** Stars, particles, and the starfield backdrop are each a single `Graphics`. Do not create one display object per entity — it breaks batching.
- **Basket is a single `Graphics` redrawn only when `basket.dirty === true`** (i.e. fill-level or ease state changed). The fill visual — stars piling inside — is a particle overlay, not a per-frame redraw of the weave.
- **Bloom uniforms update at most once per frame.** Don't push per-entity uniform churn.

If a GPU struggles, dial back in this order: `BloomFilter.quality` 4→2, star pool 120→80, particle pool 600→400, disable `SPHERE` scene entirely.

### Input

`src/input.ts` is keyboard-centric — the basket reads `Input.axis()` which returns `-1..1` for left/right (arrows, A/D). `Space` or `Enter` triggers an early scatter when the basket is at least half full; `P` toggles pause; `M` mutes. Touch input in `src/touchControls.ts` does **not** introduce a parallel code path: the whole canvas is a drag zone that feeds `setTouchAxis(...)` with a basket-follows-finger model (the basket eases toward `touchX` rather than snapping — this is what makes the feel calm). A two-finger tap triggers the scatter shortcut via `setVirtualKey("Space", …)`. `steerAxis()` gives touch priority over keys while a finger is down. `Input.endFrame()` must be called at the end of every tick to clear `pressedThisFrame`.

Global keydown in `Game.init` `preventDefault`s arrow/space so the page never scrolls while playing.

### Audio: `src/audio.ts`

All sound is synthesized with the Web Audio API against a single `AudioContext` that is lazy-created on the first user gesture (mobile autoplay policy). The audio graph is:

```
[Pad oscillators] ─┐
[Chime oscillators]┼→ masterGain → compressor → destination
[Rain noise]      ─┘
```

- `pad()` — two slowly detuned sine oscillators with a long attack; this is the ambient bed and is never stopped, only modulated in gain as scenes change.
- `chime(note)` — a short pentatonic bell played when a star is caught. Pentatonic notes are drawn from `CONFIG.audio.scale` so chimes can never clash.
- `scatter()` — a rising shimmer (filter sweep over filtered noise plus a bell arpeggio) triggered once at the start of `SCATTERING`.
- `rain()` — optional gentle pink-ish noise, off by default.

Never create a long-lived oscillator inside the hot tick — chimes are short one-shots and GC-friendly, but the pad and rain are long-lived singletons.

### Tuning surface: `src/config.ts`

`CONFIG` is the single source of truth for canvas size, basket speed and capacity, star fall speed range, scene durations, palettes, audio scale, and the `localStorage` key for persisted state (muted, completed scatters, last scene index). Prefer adjusting `CONFIG` over hard-coding numbers in gameplay code.

### Persistence

`src/storage.ts` persists a tiny state blob (`muted`, `totalScatters`, `lastSceneIndex`) under `CONFIG.storage.key` in `localStorage`. The key is **versioned** (`…/v1`) — bump the version if you change the shape, don't migrate silently. There are no highscores in this game.

### Responsive canvas

The Pixi canvas is rendered at a fixed internal resolution (`CONFIG.width` × `CONFIG.height` = 960×720) and CSS-scaled to fit the viewport via `applyResponsiveScale()` in `src/responsive.ts`. Listeners are wired for `resize`, `orientationchange`, and `fullscreenchange` (the fullscreen handler waits one RAF for viewport metrics to settle).

## Conventions

- TypeScript `strict`. Keep comments in English.
- 60 fps target on a 2020-era integrated GPU — treat frame budget as a real constraint, especially because this game is expected to run for long idle periods without warming up a phone.
- All visuals are generative. Don't add image/audio assets without a strong reason; prefer a `Graphics` or a Web Audio oscillator.
- The dev HTML lives at `dev/index.html`. Don't add a second `index.html` at the repo root for dev — it will collide with the Pages redirect.
- This game is designed to help people fall asleep. Avoid sudden contrast changes, high-pitched sounds, flashing, or punitive UX (no "you lost", no timers, no score that goes down). If a change might startle a half-asleep player, it's wrong for this codebase.
