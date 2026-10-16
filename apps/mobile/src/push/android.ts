/**
 * Android notification actions, pure part. `@capacitor/push-notifications`
 * cannot put action buttons on an FCM *notification* message, so for a
 * data-only FCM message carrying Klorn's payload the app posts the
 * notification itself through `@capacitor/local-notifications`
 * (platform/local-notify.ts) with three actions — 1시간 뒤에 · 처리 완료 ·
 * 검토하기 (In 1 hour · Done · Review). Review only opens the approval card
 * or the mail: nothing is ever sent from a notification, on Android either.
 *
 * Message shape the server sends (every FCM data value is a string):
 *
 *   { "data": { "title", "body", "category": "KLORN_PUSH_DRAFT" | "KLORN_PUSH",
 *               "emailId", "attentionItemId", "pendingActionId", "route",
 *               "lane", "sentAt" (epoch ms) },
 *     "android": { "priority": "high" } }        // and NO "notification" key
 *
 * See README "Push payload" for what works in which app state (a data-only
 * message reaches the app only while its process is alive).
 */
import type { PushData } from "./route";
import { PUSH_ACTIONS } from "./route";

/** Android notification channels (created at launch; importance is the user's afterwards). */
export const ANDROID_CHANNELS = {
  /** PUSH-lane mail: IMPORTANCE_HIGH (heads-up, sound). */
  push: { id: "klorn_push", importance: 4 },
  /** Everything else Klorn sends (MEETING, briefings): IMPORTANCE_DEFAULT. */
  other: { id: "klorn_other", importance: 3 },
} as const;

export type AndroidChannelId = (typeof ANDROID_CHANNELS)[keyof typeof ANDROID_CHANNELS]["id"];

/** Action sets, by the same category ids iOS registers (AppDelegate.swift). */
export const ACTION_CATEGORIES = {
  withDraft: "KLORN_PUSH_DRAFT",
  plain: "KLORN_PUSH",
} as const;

export type ActionCategory = (typeof ACTION_CATEGORIES)[keyof typeof ACTION_CATEGORIES];

/** A data-only message older than this is a replay (the plugin re-fires its last message on launch). */
export const STALE_AFTER_MS = 15 * 60_000;

const ID = /^[A-Za-z0-9_-]{1,128}$/;
const TITLE_MAX = 120;
const BODY_MAX = 600;
const LANES = new Set(["PUSH", "MEETING", "QUEUE", "INFO", "SILENT"]);

export interface IncomingMessage {
  /** Set when FCM carried a `notification` block (the OS showed it already). */
  title?: string | null;
  data: PushData;
}

export interface DataPush {
  /** Stable per mail / item, so a repeat replaces the notification instead of stacking. */
  notificationId: number;
  title: string;
  body: string;
  /** Which action set; null = no buttons (a tap still routes). */
  category: ActionCategory | null;
  channelId: AndroidChannelId;
  /** Only the validated fields, handed back on tap / action (push/route.ts reads them). */
  data: PushData;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function id(value: unknown): string | null {
  return typeof value === "string" && ID.test(value) ? value : null;
}

/** 31-bit positive FNV-1a hash — Android notification ids are Java ints. */
export function notificationIdOf(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 1 || 1;
}

/**
 * The notification to post for a data-only Klorn message, or null: a
 * notification message (the OS displayed it), a payload without a title and
 * body, or a stale replay. Everything is external input and validated.
 */
export function parseDataPush(message: IncomingMessage, now: number): DataPush | null {
  if (message.title) return null;
  const data = message.data ?? {};
  const title = text(data.title, TITLE_MAX);
  const body = text(data.body, BODY_MAX);
  if (!title || !body) return null;

  const sentAt = typeof data.sentAt === "string" ? Number(data.sentAt) : Number.NaN;
  if (Number.isFinite(sentAt) && now - sentAt > STALE_AFTER_MS) return null;

  const emailId = id(data.emailId);
  const attentionItemId = id(data.attentionItemId);
  const pendingActionId = id(data.pendingActionId);
  const declared = Object.values(ACTION_CATEGORIES).find((c) => c === data.category) ?? null;
  const category: ActionCategory | null =
    declared ??
    (pendingActionId
      ? ACTION_CATEGORIES.withDraft
      : attentionItemId
        ? ACTION_CATEGORIES.plain
        : null);

  const lane = typeof data.lane === "string" && LANES.has(data.lane) ? data.lane : null;
  const isPush = lane ? lane === "PUSH" : category !== null;

  const kept: PushData = {};
  if (emailId) kept.emailId = emailId;
  if (attentionItemId) kept.attentionItemId = attentionItemId;
  if (pendingActionId) kept.pendingActionId = pendingActionId;
  if (typeof data.route === "string") kept.route = data.route;
  if (typeof data.url === "string") kept.url = data.url;

  return {
    notificationId: notificationIdOf(
      attentionItemId ?? emailId ?? pendingActionId ?? `${title}\n${body}`,
    ),
    title,
    body,
    category,
    channelId: isPush ? ANDROID_CHANNELS.push.id : ANDROID_CHANNELS.other.id,
    data: kept,
  };
}

export interface ActionLabels {
  later: string;
  done: string;
  review: string;
}

/**
 * The action types to register, in the order Android shows the buttons:
 * 1시간 뒤에 · 처리 완료 · 검토하기. Review is the "Send draft" of iOS without
 * the send: it opens the approval card (or the mail) in the app.
 */
export function androidActionTypes(labels: ActionLabels) {
  const later = { id: PUSH_ACTIONS.later, title: labels.later };
  const done = { id: PUSH_ACTIONS.done, title: labels.done };
  const review = { id: PUSH_ACTIONS.review, title: labels.review };
  return [
    { id: ACTION_CATEGORIES.withDraft, actions: [later, done, review] },
    { id: ACTION_CATEGORIES.plain, actions: [later, done, review] },
  ];
}
