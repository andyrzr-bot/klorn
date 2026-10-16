/**
 * How much of the window the on-screen keyboard covers, in CSS px, so a
 * composer and its buttons stay above it (canvas notes.gestures).
 *
 *  - iOS: Keyboard `resize: "body"` shrinks <body>, but fixed-position sheets
 *    are laid out against the viewport, which does not shrink — so the
 *    keyboard height from @capacitor/keyboard's will-show event is the inset.
 *  - Android: `adjustResize` shrinks the WebView itself; nothing to add.
 *  - Browser (dev, tests) and any WebView that overlays instead of resizing:
 *    the visualViewport shrinks, and the difference is the inset.
 */
import { useEffect, useState } from "react";
import { hasPlugin, platformName } from "./native";

export function visualViewportInset(): number {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  if (!vv) return 0;
  return Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
}

export function useKeyboardInset(): number {
  const [viewportInset, setViewportInset] = useState(0);
  const [nativeInset, setNativeInset] = useState(0);
  useEffect(() => {
    const update = () => setViewportInset(visualViewportInset());
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    let cancelled = false;
    const removers: Array<() => void> = [];
    if (platformName() === "ios" && hasPlugin("Keyboard")) {
      void import("@capacitor/keyboard").then(({ Keyboard }) => {
        if (cancelled) return;
        const show = Keyboard.addListener("keyboardWillShow", (info) =>
          setNativeInset(info.keyboardHeight),
        );
        const hide = Keyboard.addListener("keyboardWillHide", () => setNativeInset(0));
        removers.push(
          () => void show.then((h) => h.remove()),
          () => void hide.then((h) => h.remove()),
        );
      });
    }
    update();
    return () => {
      cancelled = true;
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      for (const remove of removers) remove();
    };
  }, []);
  return Math.max(viewportInset, nativeInset);
}
