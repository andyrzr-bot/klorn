/**
 * Wire shapes the mobile app reads that are NOT (yet) in @klorn/contract.
 * Each mirrors a server response field-for-field for the fields read here,
 * with the route it comes from. They are candidates to move into
 * packages/contract (open question in apps/mobile/README.md) — until then a
 * server change here is not caught by the compiler, so keep them minimal.
 */
import type { LiveTier } from "@klorn/contract";

/** `user` on POST /api/auth/login, /register and GET /api/auth/me. */
export interface MeUser {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  role?: string;
  entitled?: boolean;
  paywalled?: boolean;
  /** GET /me only — the user's IANA zone (AutomationConfig.timezone). */
  timezone?: string;
  hasAnyMailSource?: boolean;
  googleConnected?: boolean;
  googleNeedsReconnect?: boolean;
}

/** POST /api/auth/login (200) and /register (201). */
export interface LoginResponse {
  token: string;
  user: MeUser;
}

/** GET /api/auth/me. */
export interface MeResponse {
  user: MeUser;
}

/** GET /api/auth/desktop-nonce?challenge= */
export interface DesktopNonceResponse {
  nonce: string;
}

/** GET /api/auth/desktop-token/:nonce — 202 {status:"pending"} or 200 {status:"ok", token}. */
export type DesktopTokenResponse = { status: "pending" } | { status: "ok"; token: string };

/** POST /api/auth/exchange-code */
export interface ExchangeCodeResponse {
  token: string;
}

/**
 * One row of GET /api/calendar?start=&end= (`events`). Same fields the web
 * Today reads (packages/web/src/app/today/model.ts CalendarEventWire), plus
 * meetingLink, which the "Join" button opens.
 */
export interface CalendarEventWire {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string | null;
  meetingLink?: string | null;
  allDay: boolean;
  color?: string | null;
  /** CalendarProvider: GOOGLE, OUTLOOK, ICLOUD, NAVER, DEVICE, LOCAL. */
  provider?: string;
  /** The linked account's label, on a linked calendar's event only. */
  sourceLabel?: string;
  readOnly?: true;
}

export interface CalendarEventsResponse {
  events: CalendarEventWire[];
}

/** One row of GET /api/chat/pending-actions (routes/chat-pending-actions.ts). */
export interface PendingActionWire {
  id: string;
  conversationId: string;
  conversationTitle: string | null;
  status: string;
  toolName: string;
  /** JSON-encoded tool arguments, as stored. */
  toolArgs: string;
  targetLabel: string | null;
  reasoning: string | null;
  result: string | null;
  createdAt: string;
}

export interface PendingActionsResponse {
  actions: PendingActionWire[];
}

/** The fields of GET /api/email/:id the reader will read (routes/email.ts). */
export interface EmailDetailWire {
  id: string;
  gmailId: string;
  threadId: string | null;
  from: string;
  senderEmail: string | null;
  to: string;
  cc?: string | null;
  subject: string;
  snippet: string | null;
  /** Plain-text body as served (serveBody). */
  body: string | null;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  summary: string | null;
  keyPoints: string[];
  needsReply: boolean;
  needsReplyReason?: string | null;
  attachmentCount: number;
  tier?: LiveTier | null;
}
