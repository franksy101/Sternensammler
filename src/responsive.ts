import { CONFIG } from "./config";

/**
 * CSS-scale the Pixi canvas to fit the viewport while preserving the
 * internal resolution. The canvas keeps CONFIG.width x CONFIG.height
 * pixels; we only set its CSS width/height.
 */
export function applyResponsiveScale(canvas: HTMLCanvasElement): void {
  const margin = window.matchMedia("(pointer: coarse)").matches ? 4 : 16;
  const availW = window.innerWidth - margin * 2;
  const availH = window.innerHeight - margin * 2;
  const scale = Math.min(availW / CONFIG.width, availH / CONFIG.height);
  const w = Math.floor(CONFIG.width * scale);
  const h = Math.floor(CONFIG.height * scale);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
}

export function installResponsive(canvas: HTMLCanvasElement): void {
  const handler = () => applyResponsiveScale(canvas);
  handler();
  window.addEventListener("resize", handler);
  window.addEventListener("orientationchange", handler);
  document.addEventListener("fullscreenchange", () => {
    requestAnimationFrame(handler);
  });
}
