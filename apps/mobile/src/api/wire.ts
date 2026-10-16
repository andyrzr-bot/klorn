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
  /**
   * Sanitized HTML (server sanitize-html allowlist) for clients that render
   * mail as designed; null for genuinely plain mail. The reader sanitizes it
   * again (screens/mail/mail-html.ts) and shows it in a script-less frame.
   */
  renderHtml?: string | null;
  /** Stored attachment rows (mail/email-attachments.ts EmailAttachmentView). */
  attachments?: EmailAttachmentWire[];
  /** A reply written ahead of time (proactive drafts); null once answered. */
  proactiveDraft?: string | null;
  labels?: string[];
}

/** One attachment of GET /api/email/:id (`attachments`), the fields the reader shows. */
export interface EmailAttachmentWire {
  id: string;
  emailId: string;
  filename: string;
  mimeType: string;
  size: number | null;
  /** The AI summary of the file, when analysis ran. */
  summary: string | null;
  analysisStatus: string;
}

/** GET /api/email/:id/thread-brief (routes/email.ts, mail/thread-brief.ts). */
export interface ThreadBriefWire {
  whyNow: string;
  asks: string[];
  weOwe: string | null;
  theyOwe: string | null;
  stance: string | null;
  messageCount: number;
  lastMessageAt: string | null;
}

export interface ThreadBriefResponse {
  brief: ThreadBriefWire | null;
}

/** GET /api/email/:id/sender-dossier (routes/email.ts, mail/sender-dossier.ts). */
export interface SenderDossierWire {
  summary: string;
  openThreads: string[];
  lastPromise: string | null;
  emailCount: number;
  lastEmailAt: string | null;
}

/** POST /api/email/:id/reply-draft (routes/email-replies.ts). */
export interface ReplyDraftResponse {
  to: string;
  subject: string;
  body: string;
}

/**
 * POST /api/email/:id/reply and POST /api/email/send — the provider's answer
 * (mail/providers/types.ts SendMailResult, success branch). `to` is echoed by
 * /reply only: the address the server actually sent to.
 */
export interface SendMailResponse {
  success: true;
  messageId?: string | null;
  threadId?: string | null;
  to?: string;
  threaded?: boolean;
}

/** POST /api/email/:id/gmail-draft — the draft saved in the mail account. */
export interface SavedDraftResponse {
  success?: boolean;
  draftId?: string | null;
}

/** GET /api/email/:id/reader-context (routes/email-lanes.ts; dark unless MAIL_V2). */
export type { EmailReaderContextResponse } from "@klorn/contract";

/**
 * Subscriptions (routes/email-subscriptions.ts, dark unless
 * BULK_UNSUBSCRIBE_ENABLED). Not on main's contract yet — mirrored from the
 * branch that adds the route, field for field.
 */
export type EmailUnsubscribeMethod = "one-click" | "mailto" | "link";

export interface EmailSubscriptionWire {
  /** Normalized sender address. */
  sender: string;
  displayName: string | null;
  /** null = the primary account. Never merged across accounts. */
  linkedInboxAccountId: string | null;
  accountLabel: string | null;
  count: number;
  unreadCount: number;
  lastReceivedAt: string;
  method: EmailUnsubscribeMethod;
}

export interface EmailSubscriptionsResponse {
  subscriptions: EmailSubscriptionWire[];
  windowDays: number;
}

export type EmailSubscriptionUnsubscribeResponse = (
  | { method: "one-click" | "mailto"; done: true }
  | { method: "link"; done: false; url: string }
) & {
  archived: number;
  archiveFailed: number;
};
