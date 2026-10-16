/**
 * Keyboard-aware layout (canvas notes.gestures: "the composer and its buttons
 * ride above the keyboard"). Native: Capacitor resizes the body
 * (capacitor.config.ts Keyboard.resize = "body"); this adds
 * `html.keyboard-open` so the tab bar steps aside. Browser / iOS overlay
 * keyboards: the visual viewport's lost height becomes `--keyboard-inset`.
 */
import { isNative } from "./native";

export function installKeyboardInsets(): () => void {
  const root = document.documentElement;
  const cleanups: Array<() => void> = [];
  const vv = window.visualViewport;
  if (vv) {
    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      root.style.setProperty("--keyboard-inset", `${inset}px`);
      if (!isNative()) root.classList.toggle("keyboard-open", inset > 80);
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    cleanups.push(() => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    });
  }
  if (isNative()) {
    let alive = true;
    void import("@capacitor/keyboard")
      .then(async ({ Keyboard }) => {
        const show = await Keyboard.addListener("keyboardWillShow", () =>
          root.classList.add("keyboard-open"),
        );
        const hide = await Keyboard.addListener("keyboardWillHide", () =>
          root.classList.remove("keyboard-open"),
        );
        if (!alive) {
          void show.remove();
          void hide.remove();
          return;
        }
        cleanups.push(() => {
          void show.remove();
          void hide.remove();
        });
      })
      .catch(() => {});
    cleanups.push(() => {
      alive = false;
    });
  }
  return () => {
    for (const fn of cleanups) fn();
    root.classList.remove("keyboard-open");
  };
}
