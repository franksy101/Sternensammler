/**
 * Keyboard-centric input. Touch code paths synthesize keyboard events via
 * setVirtualKey() so the rest of the game only reads one surface.
 */

const down = new Set<string>();
const pressedThisFrame = new Set<string>();

let touchAxisValue = 0;
let touchAxisActive = false;

export const Input = {
  install(target: HTMLElement | Window = window) {
    const el = target as Window;
    el.addEventListener("keydown", (e) => {
      const code = (e as KeyboardEvent).code;
      if (!down.has(code)) pressedThisFrame.add(code);
      down.add(code);
    });
    el.addEventListener("keyup", (e) => {
      const code = (e as KeyboardEvent).code;
      down.delete(code);
    });
    window.addEventListener("blur", () => {
      down.clear();
    });
  },

  isDown(code: string): boolean {
    return down.has(code);
  },

  pressed(code: string): boolean {
    return pressedThisFrame.has(code);
  },

  anyDown(codes: string[]): boolean {
    for (const c of codes) if (down.has(c)) return true;
    return false;
  },

  /**
   * Keyboard steering axis, -1..1. Arrow keys and WASD both work.
   * Does NOT include the touch axis — see steerAxis() for the merged value.
   */
  keyAxis(): number {
    let x = 0;
    if (down.has("ArrowLeft") || down.has("KeyA")) x -= 1;
    if (down.has("ArrowRight") || down.has("KeyD")) x += 1;
    return x;
  },

  /**
   * Merged steering axis. Touch takes priority while a finger is down so
   * the basket tracks the finger without the keys fighting it.
   */
  steerAxis(): number {
    if (touchAxisActive) return touchAxisValue;
    return Input.keyAxis();
  },

  /** Called by touchControls to feed a -1..1 axis value. */
  setTouchAxis(value: number, active: boolean) {
    touchAxisValue = Math.max(-1, Math.min(1, value));
    touchAxisActive = active;
  },

  /** Called by touchControls to synthesize key presses (e.g. Space). */
  setVirtualKey(code: string, isDown: boolean) {
    if (isDown) {
      if (!down.has(code)) pressedThisFrame.add(code);
      down.add(code);
    } else {
      down.delete(code);
    }
  },

  /** Must be called at the end of every tick. */
  endFrame() {
    pressedThisFrame.clear();
  },
};
