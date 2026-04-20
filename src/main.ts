import { Game } from "./game";

const errOverlay = document.getElementById("err-overlay");
function showError(msg: string) {
  if (!errOverlay) {
    // eslint-disable-next-line no-alert
    alert(msg);
    return;
  }
  errOverlay.textContent = msg;
  (errOverlay as HTMLElement).style.display = "block";
}

window.addEventListener("error", (e) => {
  showError(`Fehler: ${e.message}\n${e.error?.stack ?? ""}`);
});
window.addEventListener("unhandledrejection", (e) => {
  showError(`Unhandled: ${String(e.reason?.message ?? e.reason)}\n${e.reason?.stack ?? ""}`);
});

const host = document.getElementById("app");
if (!host) {
  showError("Kein #app Container gefunden.");
} else {
  const game = new Game();
  game.init(host).catch((err: unknown) => {
    const e = err as Error;
    showError(`Spielstart fehlgeschlagen: ${e?.message ?? String(err)}\n${e?.stack ?? ""}`);
  });
}
