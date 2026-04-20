import { Container, Graphics, Text } from "pixi.js";
import { CONFIG } from "./config";

/**
 * Minimal HUD. Soft fill meter at the bottom, gentle hint text in the corner.
 * Nothing jumps or flashes — half-asleep players must not be startled.
 */
export class Hud {
  readonly root = new Container();
  private meter = new Graphics();
  private hint: Text;
  private state: Text;
  private scatterToast: Text;
  private toastAlpha = 0;

  constructor(
    private width: number,
    private height: number,
  ) {
    this.root.addChild(this.meter);

    const baseStyle = {
      fontFamily: "Iowan Old Style, Palatino, Georgia, serif",
      fontSize: 16,
      fill: CONFIG.hud.hintColor,
      align: "left" as const,
    };

    this.hint = new Text({
      text: "Sammle die Sterntaler. Wenn der Korb voll ist, streust du sie aus.",
      style: { ...baseStyle, fontSize: 18, fill: 0xe6e7f2 },
    });
    this.hint.alpha = 0.75;
    this.hint.position.set(22, 18);
    this.root.addChild(this.hint);

    this.state = new Text({
      text: "",
      style: { ...baseStyle, fontSize: 14, fill: 0xb7c0ff },
    });
    this.state.alpha = 0.6;
    this.state.position.set(22, 44);
    this.root.addChild(this.state);

    this.scatterToast = new Text({
      text: "",
      style: {
        ...baseStyle,
        fontSize: 28,
        fill: 0xfff2c8,
        align: "center",
      },
    });
    this.scatterToast.anchor.set(0.5);
    this.scatterToast.position.set(width / 2, height * 0.32);
    this.scatterToast.alpha = 0;
    this.root.addChild(this.scatterToast);

    this.drawMeter(0);
  }

  update(dt: number, fillFraction: number, muted: boolean, totalScatters: number) {
    this.drawMeter(fillFraction);
    const parts: string[] = [];
    parts.push(`⟵ ⟶  |  Korb ${Math.round(fillFraction * 100)}%`);
    if (totalScatters > 0) parts.push(`· ausgestreut ${totalScatters}×`);
    if (muted) parts.push("· stumm (M)");
    this.state.text = parts.join("  ");

    if (this.toastAlpha > 0) {
      this.toastAlpha -= dt * 0.25;
      this.scatterToast.alpha = Math.max(0, this.toastAlpha);
    }
  }

  showToast(text: string) {
    this.scatterToast.text = text;
    this.toastAlpha = 1.8;
    this.scatterToast.alpha = 1;
  }

  private drawMeter(f: number) {
    const g = this.meter;
    g.clear();
    const w = 280;
    const h = 8;
    const x = (this.width - w) / 2;
    const y = this.height - 26;
    g.roundRect(x, y, w, h, h / 2).fill({ color: CONFIG.hud.meterBgColor, alpha: 0.55 });
    const fw = Math.max(0, Math.min(w, w * f));
    if (fw > 0) {
      g.roundRect(x, y, fw, h, h / 2).fill({ color: CONFIG.hud.meterColor, alpha: 0.9 });
      g.roundRect(x, y, fw, h / 2, h / 2).fill({ color: 0xffffff, alpha: 0.3 });
    }
  }
}
