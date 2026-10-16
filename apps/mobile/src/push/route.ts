/**
 * Where a notification tap lands. The payload is external input (FCM data /
 * APNs custom keys), so every field is validated and anything unknown lands
 * on Today. The server today sends `url` (a WEB path such as
 * `/email/<id>` or `/inbox/firewall`); `route` (an app path), `emailId`,
 * `attentionItemId` and `pendingActionId` are read when present — see
 * README "Push payload" for what the server should send.
 */
import { parseRoute, type Route } from "../router/routes";

export type PushData = Record<string, unknown>;

const ID = /^[A-Za-z0-9_-]{1,128}$/;

function idOf(value: unknown): string | null {
  return typeof value === "string" && ID.test(value) ? value : null;
}

function pathOf(value: unknown): { pathname: string; search: string } | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return null;
  try {
    const url = new URL(value, "https://app.invalid");
    if (url.origin !== "https://app.invalid") return null;
    return { pathname: url.pathname, search: url.search };
  } catch {
    return null;
  }
}

/** The web app's paths (what the server's `url` carries) → the app's routes. */
export function routeFromWebPath(path: string, search = ""): Route {
  const email = path.match(/^\/email\/([^/]+)$/)?.[1];
  if (email && idOf(decodeURIComponent(email)))
    return { name: "mail", id: decodeURIComponent(email) };
  if (path === "/inbox/firewall" || path === "/email") return { name: "mail", lane: "PUSH" };
  if (path === "/briefing" || path === "/assistant/briefing")
    return { name: "assistant", section: "briefing" };
  if (path === "/chat" || path === "/assistant/chat") return { name: "assistant", section: "chat" };
  if (path === "/inbox" || path === "/assistant/approvals")
    return { name: "assistant", section: "approvals" };
  if (path === "/inbox/receipt" || path === "/assistant/activity")
    return { name: "assistant", section: "activity" };
  const app = parseRoute(path, search);
  return app.name === "notFound" ? { name: "today" } : app;
}

export function routeFromPush(data: PushData | null | undefined): Route {
  if (!data) return { name: "today" };
  const appPath = pathOf(data.route);
  if (appPath) {
    const route = parseRoute(appPath.pathname, appPath.search);
    if (route.name !== "notFound") return route;
  }
  const pendingActionId = idOf(data.pendingActionId);
  if (pendingActionId) return { name: "assistant", section: "approvals", id: pendingActionId };
  const emailId = idOf(data.emailId);
  if (emailId) return { name: "mail", id: emailId };
  const web = pathOf(data.url);
  if (web) return routeFromWebPath(web.pathname, web.search);
  return { name: "today" };
}

/**
 * The notification action buttons: iOS UNNotificationCategory actions
 * (AppDelegate.swift) and the Android local-notification action types
 * (push/android.ts) share these ids.
 */
export const PUSH_ACTIONS = {
  /** iOS "Send draft" — opens the approval card; it never sends. */
  send: "KLORN_SEND",
  /** Android "Review" — opens the approval card / the mail. */
  review: "KLORN_REVIEW",
  later: "KLORN_LATER",
  done: "KLORN_DONE",
} as const;

export type PushIntent =
  | { kind: "open"; route: Route }
  /** "Send draft" / "Review" never send: they open the approval card, where the user taps Send. */
  | { kind: "review"; route: Route }
  | { kind: "snooze"; attentionItemId: string; fallback: Route }
  | { kind: "done"; attentionItemId: string; fallback: Route };

export function intentOf(actionId: string, data: PushData | null | undefined): PushIntent {
  const route = routeFromPush(data);
  const attentionItemId = idOf(data?.attentionItemId);
  switch (actionId) {
    case PUSH_ACTIONS.send:
    case PUSH_ACTIONS.review:
      return { kind: "review", route };
    case PUSH_ACTIONS.later:
      return attentionItemId
        ? { kind: "snooze", attentionItemId, fallback: route }
        : { kind: "open", route };
    case PUSH_ACTIONS.done:
      return attentionItemId
        ? { kind: "done", attentionItemId, fallback: route }
        : { kind: "open", route };
    default:
      return { kind: "open", route };
  }
}
