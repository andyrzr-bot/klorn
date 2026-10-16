/**
 * The parts of the app config that are pure and environment-free, so the Vite
 * config (Node) can share them with the app. See config.ts for the rest.
 *
 * Prod is the Render origin every shipped client already uses (packages/web
 * next.config.ts, apps/desktop-mac make-app.sh, render.yaml
 * RENDER_EXTERNAL_URL). `api.klorn.ai` is a CNAME to the same service
 * (docs/casa/evidence-map.md) and can replace it once the founder decides
 * which host clients should pin.
 */
export const PROD_API_BASE = "https://klorn-api.onrender.com";
export const DEV_API_BASE = "http://localhost:3001";

/** The custom scheme the API relays OAuth results to (NATIVE_OAUTH_SCHEMES). */
export const NATIVE_OAUTH_SCHEME = "ai.klorn.app";

/**
 * Plain http is accepted ONLY for local development hosts, so a bad build env
 * can never send the Bearer token off-TLS to a remote host (same rule as the
 * Mac app's Config.validated). Returns the base without a trailing slash, or
 * null for anything unusable.
 */
export function validateApiBase(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const scheme = url.protocol.replace(":", "").toLowerCase();
  if (scheme !== "https" && scheme !== "http") return null;
  if (scheme === "http") {
    const host = url.hostname.toLowerCase();
    if (host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]" && host !== "10.0.2.2") {
      return null;
    }
  }
  return raw.replace(/\/+$/, "");
}
