/**
 * Typed endpoints — every route the mobile app calls, in one place, with the
 * server file that answers it. Shapes come from @klorn/contract where the
 * contract has them, else from ./wire.ts.
 */
import type {
  AuthProvidersResponse,
  BriefingStatus,
  EmailLaneCountsResponse,
  EmailListResponse,
  EmailReaderContextResponse,
  FirewallResponse,
  InboxesResponse,
  LaneOverrideByEmailResponse,
  LaneOverrideUndoResponse,
  LiveTier,
} from "@klorn/contract";
import type { ApiClient, RequestOptions } from "./client";
import type {
  CalendarEventsResponse,
  DesktopNonceResponse,
  DesktopTokenResponse,
  EmailDetailWire,
  EmailSubscriptionsResponse,
  EmailSubscriptionUnsubscribeResponse,
  ExchangeCodeResponse,
  LoginResponse,
  MeResponse,
  PendingActionsResponse,
  ReplyDraftResponse,
  SavedDraftResponse,
  SenderDossierWire,
  SendMailResponse,
  ThreadBriefResponse,
} from "./wire";

/** A lane filter as Mail's list takes it (`tier=`): a live lane or ALL. */
export type LaneFilter = LiveTier | "ALL";

/** `inbox=` scope: every account, the primary one, or a linked inbox id. */
export type InboxScope = "all" | "primary" | (string & {});

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

export function endpoints(api: ApiClient) {
  return {
    auth: {
      /** routes/auth.ts GET /providers — which sign-in buttons this deployment has. */
      providers: (o?: RequestOptions) =>
        api.get<AuthProvidersResponse>("/api/auth/providers", { anonymous: true, ...o }),
      /** routes/auth.ts POST /login */
      login: (email: string, password: string) =>
        api.post<LoginResponse>("/api/auth/login", { email, password }, { anonymous: true }),
      /** routes/auth.ts GET /me */
      me: (o?: RequestOptions) => api.get<MeResponse>("/api/auth/me", o),
      /** routes/auth.ts POST /logout — drops this device's session row. */
      logout: () => api.post<{ success: boolean }>("/api/auth/logout"),
      /** routes/auth.ts GET /desktop-nonce — PKCE challenge required. */
      desktopNonce: (challenge: string) =>
        api.get<DesktopNonceResponse>(`/api/auth/desktop-nonce${query({ challenge })}`, {
          anonymous: true,
        }),
      /** routes/auth.ts GET /desktop-token/:nonce — the PKCE-bound poll (browser fallback). */
      desktopToken: async (nonce: string, verifier: string) => {
        const { data } = await api.request<DesktopTokenResponse>(
          "GET",
          `/api/auth/desktop-token/${encodeURIComponent(nonce)}`,
          undefined,
          { anonymous: true, headers: { "x-desktop-verifier": verifier } },
        );
        return data;
      },
      /** routes/auth.ts POST /exchange-code — the relay's one-time code → JWT. */
      exchangeCode: (code: string) =>
        api.post<ExchangeCodeResponse>("/api/auth/exchange-code", { code }, { anonymous: true }),
      /**
       * The URL the system browser opens for a social login (routes/auth.ts
       * GET /google/login, routes/social-auth.ts GET /apple/login). The
       * `appScheme` asks the callback to relay to the app's custom scheme.
       */
      socialLoginUrl: (provider: "google" | "apple", nonce: string, appScheme?: string) =>
        `${api.baseUrl}/api/auth/${provider}/login${query({ source: "desktop", nonce, appScheme })}`,
    },
    mail: {
      /** routes/inbox/firewall GET / — open attention items by lane, with reasons. */
      firewall: (inbox?: InboxScope, o?: RequestOptions) =>
        api.get<FirewallResponse>(`/api/inbox/firewall${query({ inbox })}`, o),
      /** routes/email-lanes.ts GET /lane-counts (dark unless MAIL_V2 or UNIFIED_HOME). */
      laneCounts: (inbox?: InboxScope, o?: RequestOptions) =>
        api.get<EmailLaneCountsResponse>(`/api/email/lane-counts${query({ inbox })}`, o),
      /** routes/email.ts GET / — the paged list; `tier` honoured while a lane reader is on. */
      list: (
        params: { tier?: LaneFilter; page?: number; inbox?: InboxScope; search?: string },
        o?: RequestOptions,
      ) =>
        api.get<EmailListResponse>(
          `/api/email${query({
            search: params.search?.trim(),
            page: params.page ?? 1,
            inbox: params.inbox === "all" ? undefined : params.inbox,
            tier: params.tier,
          })}`,
          o,
        ),
      /** routes/email.ts GET /:id */
      detail: (id: string, o?: RequestOptions) =>
        api.get<EmailDetailWire>(`/api/email/${encodeURIComponent(id)}`, o),
      /** routes/email.ts GET /inboxes — the connected accounts ("inboxes"). */
      inboxes: (o?: RequestOptions) => api.get<InboxesResponse>("/api/email/inboxes", o),
      /**
       * routes/email-lanes.ts GET /:id/reader-context — lane + tierReason + the
       * mail's neighbours in the list view (dark 404 unless MAIL_V2; the reader
       * then falls back to the firewall item and the cached list).
       */
      readerContext: (
        id: string,
        view: { tier: LaneFilter; inbox: InboxScope; search?: string },
        o?: RequestOptions,
      ) =>
        api.get<EmailReaderContextResponse>(
          `/api/email/${encodeURIComponent(id)}/reader-context${query({
            tier: view.tier,
            inbox: view.inbox === "all" ? undefined : view.inbox,
            search: view.search?.trim(),
          })}`,
          o,
        ),
      /**
       * routes/email.ts POST /sync — pull-to-refresh: new mail from the primary
       * account and every linked inbox. Answers 200 with `{ error }` on a dead
       * token, so the caller treats `error` as a failure.
       */
      sync: () =>
        api.post<{ newCount?: number; synced?: number; error?: string }>("/api/email/sync"),
      /**
       * routes/email-mutations.ts PATCH /:id/read — reading is a GET and side-effect
       * free; marking read is this explicit write (synced to the mail's own account).
       */
      markRead: (id: string, isRead = true) =>
        api.request<{ success?: boolean }>("PATCH", `/api/email/${encodeURIComponent(id)}/read`, {
          isRead,
        }),
      /** routes/email.ts GET /:id/thread-brief — "why did they write now" ({brief:null} for IMAP). */
      threadBrief: (id: string, lang: "ko" | "en", o?: RequestOptions) =>
        api.get<ThreadBriefResponse>(
          `/api/email/${encodeURIComponent(id)}/thread-brief${query({ lang })}`,
          o,
        ),
      /** routes/email.ts GET /:id/sender-dossier — relationship context (503 without an AI key). */
      senderDossier: (id: string, lang: "ko" | "en", o?: RequestOptions) =>
        api.get<SenderDossierWire>(
          `/api/email/${encodeURIComponent(id)}/sender-dossier${query({ lang })}`,
          o,
        ),
      /**
       * routes/email-attachments.ts GET /:id/attachments/:attachmentId/download —
       * bytes from the mail's OWN account (linked inbox included). Authenticated,
       * so the reader fetches it and hands the blob to the OS.
       */
      attachmentPath: (id: string, attachmentId: string) =>
        `/api/email/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}/download`,
    },
    /**
     * Replies and new mail. Sending is one of the three real-world actions
     * (deterministic floor): it only ever happens from the confirm sheet, on
     * an explicit tap, with exactly the bytes shown there.
     */
    compose: {
      /** routes/email-replies.ts POST /:id/reply-draft — `intent` steers a regeneration. */
      replyDraft: (id: string, intent?: string) =>
        api.post<ReplyDraftResponse>(
          `/api/email/${encodeURIComponent(id)}/reply-draft`,
          intent ? { intent } : {},
        ),
      /**
       * routes/email-replies.ts POST /:id/reply — sends from the mail's own
       * account (the server reads linkedInboxAccountId from the row), threaded.
       */
      sendReply: (id: string, body: string) =>
        api.post<SendMailResponse>(`/api/email/${encodeURIComponent(id)}/reply`, { body }),
      /** routes/email-replies.ts POST /:id/gmail-draft — keep it as a draft in the account. */
      saveReplyDraft: (id: string, draft: { to: string; subject: string; body: string }) =>
        api.post<SavedDraftResponse>(`/api/email/${encodeURIComponent(id)}/gmail-draft`, draft),
      /** routes/email-mutations.ts POST /send — a new mail; the server sends it from the primary account. */
      send: (mail: { to: string; subject: string; body: string }) =>
        api.post<SendMailResponse>("/api/email/send", mail),
    },
    /**
     * routes/email-subscriptions.ts — dark (404) unless BULK_UNSUBSCRIBE_ENABLED;
     * Mail hides its entry point on 404.
     */
    subscriptions: {
      list: (o?: RequestOptions) =>
        api.get<EmailSubscriptionsResponse>("/api/email/subscriptions", o),
      /** `archive` clears that sender's recent mail from the lists too; nothing is deleted. */
      unsubscribe: (sub: {
        sender: string;
        linkedInboxAccountId: string | null;
        archive: boolean;
      }) =>
        api.post<EmailSubscriptionUnsubscribeResponse>("/api/email/subscriptions/unsubscribe", sub),
    },
    /**
     * Row triage (founder decision 2026-10-16: there is no archive gesture).
     * None of these touch the mailbox itself; a lane is a classification,
     * never an action.
     */
    triage: {
      /**
       * Swipe right, "Done": routes/firewall.ts POST /:id/dismiss — the attention
       * item (id = FirewallItem.id) leaves Klorn's lists, status DISMISSED; the
       * source email is untouched. The server has no un-dismiss, so the 5 s undo
       * is client-side: hide optimistically, send this only once the window ends.
       */
      done: (attentionItemId: string) =>
        api.post<{ ok: true }>(
          `/api/inbox/firewall/${encodeURIComponent(attentionItemId)}/dismiss`,
        ),
      /** "Later": routes/firewall.ts POST /:id/snooze — back to OPEN at `until`. */
      snooze: (attentionItemId: string, until: Date) =>
        api.post<{ ok: true; snoozedUntil: string }>(
          `/api/inbox/firewall/${encodeURIComponent(attentionItemId)}/snooze`,
          { snoozeUntil: until.toISOString() },
        ),
      /**
       * Swipe left → lane sheet → "Move to <LANE>": routes/firewall.ts
       * POST /email/:emailId. Reversible: the answer carries `itemId` +
       * `undoToken` (+ `undoExpiresAt`) for `undoMove`. The server learns from
       * the correction (two identical moves auto-pin the sender,
       * learning/sender-policy.ts).
       */
      moveLane: (emailId: string, tier: LiveTier) =>
        api.post<LaneOverrideByEmailResponse>(
          `/api/inbox/firewall/email/${encodeURIComponent(emailId)}`,
          { tier },
        ),
      /**
       * routes/firewall.ts POST /:id — the older, irreversible override by
       * attention item id. Only used while KEYBOARD_TRIAGE keeps the by-email
       * route dark (Fastify's bare 404).
       */
      moveLaneByItem: (attentionItemId: string, tier: LiveTier) =>
        api.post<{ ok: true; tier: LiveTier }>(
          `/api/inbox/firewall/${encodeURIComponent(attentionItemId)}`,
          { tier },
        ),
      /** routes/firewall.ts POST /:id/undo — 409 undo_expired / undo_conflict change nothing. */
      undoMove: (attentionItemId: string, undoToken: string) =>
        api.post<LaneOverrideUndoResponse>(
          `/api/inbox/firewall/${encodeURIComponent(attentionItemId)}/undo`,
          { undoToken },
        ),
      /** "Keep this sender here": routes/email.ts POST /:id/pin-tier (sender scope). */
      pinSender: (emailId: string, tier: LiveTier) =>
        api.post<{ pinned: true; sender: string; tier: LiveTier }>(
          `/api/email/${encodeURIComponent(emailId)}/pin-tier`,
          { tier, scope: "sender" },
        ),
      /** routes/email.ts DELETE /:id/pin-tier */
      unpinSender: (emailId: string) =>
        api.del<{ pinned: false; sender: string }>(
          `/api/email/${encodeURIComponent(emailId)}/pin-tier`,
        ),
    },
    calendar: {
      /** routes/calendar.ts GET /?start=&end= — every connected calendar, merged. */
      events: (start: Date, end: Date, o?: RequestOptions) =>
        api.get<CalendarEventsResponse>(
          `/api/calendar${query({ start: start.toISOString(), end: end.toISOString() })}`,
          o,
        ),
    },
    assistant: {
      /** routes/chat-pending-actions.ts GET /pending-actions — Approvals. */
      pendingActions: (o?: RequestOptions) =>
        api.get<PendingActionsResponse>("/api/chat/pending-actions", o),
      /** routes/briefing GET /status — the stored briefing; reading it runs no model. */
      briefingStatus: (o?: RequestOptions) => api.get<BriefingStatus>("/api/briefing/status", o),
    },
  };
}

export type Endpoints = ReturnType<typeof endpoints>;
