import type { Page } from "@playwright/test";

/** The fixture clock: Thursday 2026-10-16 10:28 KST (Main artboard: "11:00 · 32분 후"). */
export const FIXTURE_NOW = new Date("2026-10-16T10:28:00+09:00");

export const SHOTS_DIR = process.env.KLORN_SHOTS_DIR ?? `${process.cwd()}/test-results/shots`;

export interface Hinge {
  orientation: "vertical" | "horizontal";
  offset: number;
  maskLength: number;
}

/**
 * Emulate a fold through Chromium's device-metrics display feature (what
 * DevTools' foldable devices use). This drives the real Viewport Segments API,
 * env(viewport-segment-*) and the (horizontal|vertical)-viewport-segments
 * media queries — not an app-side simulation.
 */
export async function emulateHinge(page: Page, hinge: Hinge): Promise<boolean> {
  const size = page.viewportSize();
  if (!size) return false;
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: size.width,
      height: size.height,
      deviceScaleFactor: 1,
      mobile: false,
      displayFeature: hinge,
    });
  } catch {
    return false;
  }
  return true;
}

export async function segmentCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as unknown as { viewport?: { segments?: unknown[] | null } }).viewport?.segments
        ?.length ?? 0,
  );
}

export async function openApp(
  page: Page,
  path: string,
  options: { scenario?: string; theme?: "light" | "dark"; insets?: string } = {},
): Promise<void> {
  // install (not setFixedTime): time flows from the fixture instant, so
  // throttles and timers behave; a test lasts seconds, the copy is per minute.
  await page.clock.install({ time: FIXTURE_NOW });
  await page.emulateMedia({ colorScheme: options.theme ?? "light", reducedMotion: "reduce" });
  const sep = path.includes("?") ? "&" : "?";
  const insets = options.insets ? `&insets=${options.insets}` : "";
  await page.goto(`${path}${sep}scenario=${options.scenario ?? "default"}${insets}`);
}

/** Wait until nothing on screen is still loading. */
export async function settle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.querySelectorAll('[aria-busy="true"]').length === 0,
    null,
    {
      timeout: 15_000,
    },
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
}
