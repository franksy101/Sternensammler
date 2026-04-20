import { Input } from "./input";

/**
 * Canvas-wide drag zone. Basket eases toward the finger (ease handled by
 * basket.ts); this module only emits a -1..1 axis centred on the canvas.
 *
 * Two-finger tap synthesizes Space so the player can scatter early when
 * the basket is at least half full.
 */

export interface TouchTarget {
  /** The Pixi canvas element. */
  canvas: HTMLCanvasElement;
}

export function installTouchControls(target: TouchTarget): void {
  const { canvas } = target;
  let activePointers = 0;
  let lastX = 0;

  const toAxis = (clientX: number): number => {
    const rect = canvas.getBoundingClientRect();
    const centered = clientX - (rect.left + rect.width / 2);
    return Math.max(-1, Math.min(1, centered / (rect.width / 2)));
  };

  canvas.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType === "mouse") return; // mouse is handled below
      activePointers += 1;
      lastX = e.clientX;
      Input.setTouchAxis(toAxis(e.clientX), true);
      if (activePointers >= 2) {
        Input.setVirtualKey("Space", true);
        // release next frame — the consumer only needs the edge
        setTimeout(() => Input.setVirtualKey("Space", false), 50);
      }
    },
    { passive: true },
  );

  canvas.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "mouse") return;
      lastX = e.clientX;
      if (activePointers > 0) Input.setTouchAxis(toAxis(e.clientX), true);
    },
    { passive: true },
  );

  const end = (e: PointerEvent) => {
    if (e.pointerType === "mouse") return;
    activePointers = Math.max(0, activePointers - 1);
    if (activePointers === 0) Input.setTouchAxis(0, false);
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  // Mouse is its own path: track while button held OR whenever moving, so
  // the basket can follow the cursor even without clicking.
  canvas.addEventListener("mousemove", (e) => {
    Input.setTouchAxis(toAxis(e.clientX), true);
    lastX = e.clientX;
  });
  canvas.addEventListener("mouseleave", () => {
    Input.setTouchAxis(0, false);
  });

  // Light-handed: if something changes layout, re-emit last axis
  window.addEventListener("resize", () => {
    if (activePointers > 0) Input.setTouchAxis(toAxis(lastX), true);
  });
}
