/**
 * Realistic fixtures for the mock API (`vite --mode mock`, Playwright, unit
 * tests). The content mirrors the approved Main / Mail artboards so a mock
 * screenshot can be compared to the design one-to-one. Times are relative to
 * `now`, so a fixed clock gives a fixed picture.
 *
 * Typed against the real wire contract: if the server shape changes, these
 * stop compiling.
 */
import type {
  EmailLaneCountsResponse,
  EmailListItem,
  EmailListResponse,
  FirewallItem,
  FirewallResponse,
  InboxesResponse,
  LiveTier,
  Tier,
} from "@klorn/contract";
import type { CalendarEventWire, EmailDetailWire, MeUser, PendingActionWire } from "../wire";

const MIN = 60_000;

export const MOCK_USER: MeUser = {
  id: "user-mock",
  email: "jisu@hanbit.example",
  name: "Jisu Shin",
  plan: "PRO",
  role: "USER",
  entitled: true,
  paywalled: false,
  timezone: "Asia/Seoul",
  hasAnyMailSource: true,
  googleConnected: true,
  googleNeedsReconnect: false,
};

export const MOCK_INBOXES: InboxesResponse = {
  inboxes: [
    {
      id: null,
      email: "jisu.shin@gmail.example",
      kind: "primary",
      needsReconnect: false,
      provider: "GOOGLE",
      purpose: "personal",
    },
    {
      id: "inbox-work",
      email: "jisu@hanbit.example",
      kind: "linked",
      needsReconnect: false,
      provider: "GOOGLE",
      purpose: "work",
    },
    {
      id: "inbox-outlook",
      email: "jisu@partners.example",
      kind: "linked",
      needsReconnect: false,
      provider: "OUTLOOK",
      purpose: "work",
    },
    {
      id: "inbox-naver",
      email: "jisu@naver.example",
      kind: "linked",
      needsReconnect: false,
      provider: "NAVER",
      purpose: "personal",
    },
    {
      id: "inbox-icloud",
      email: "jisu@icloud.example",
      kind: "linked",
      needsReconnect: true,
      provider: "ICLOUD",
      purpose: "personal",
    },
  ],
  companyDomains: ["hanbit.example"],
  priorities: null,
};

export const MOCK_LANE_COUNTS: EmailLaneCountsResponse = {
  counts: {
    PUSH: { total: 2, unread: 2 },
    MEETING: { total: 3, unread: 1 },
    QUEUE: { total: 14, unread: 6 },
    INFO: { total: 21, unread: 4 },
    SILENT: { total: 48, unread: 30 },
  },
  source: "gmail",
};

function iso(now: number, offsetMin: number): string {
  return new Date(now + offsetMin * MIN).toISOString();
}

function attention(
  now: number,
  id: string,
  tier: Tier,
  title: string,
  tierReason: string,
  email: {
    subject: string;
    from: string;
    ago: number;
    needsReply?: boolean;
    accountId?: string | null;
  },
): FirewallItem {
  return {
    id,
    source: "EMAIL",
    sourceId: `email-${id}`,
    type: "email",
    title,
    tier,
    tierReason,
    priority: tier === "PUSH" ? 90 : tier === "MEETING" ? 70 : 40,
    surfacedAt: iso(now, -email.ago),
    email: {
      emailDbId: `email-${id}`,
      subject: email.subject,
      from: email.from,
      snippet: null,
      receivedAt: iso(now, -email.ago),
      signal: null,
      trust: null,
      replyState: email.needsReply ? "needsReply" : null,
      draftReady: email.needsReply ?? false,
      source: {
        provider: email.accountId === "inbox-outlook" ? "OUTLOOK" : "GOOGLE",
        accountId: email.accountId ?? null,
        label:
          email.accountId === "inbox-outlook" ? "jisu@partners.example" : "jisu@hanbit.example",
      },
      unread: true,
      hasAttachment: false,
    },
  };
}

export function mockFirewall(now: number, empty = false): FirewallResponse {
  const tiers: Record<Tier, FirewallItem[]> = {
    PUSH: [],
    MEETING: [],
    QUEUE: [],
    INFO: [],
    SILENT: [],
    AUTO: [],
  };
  if (!empty) {
    tiers.PUSH.push(
      attention(
        now,
        "att-push-1",
        "PUSH",
        "박서연 님이 계약서 회신을 기다려요",
        "오늘 18시 마감 · 두 번 언급",
        {
          subject: "계약서 수정본 — 오늘 서명 가능할까요?",
          from: "박서연 <seoyeon@hanbitpartners.example>",
          ago: 106,
          needsReply: true,
          accountId: "inbox-work",
        },
      ),
    );
    tiers.MEETING.push(
      attention(
        now,
        "att-meet-1",
        "MEETING",
        "목 14:00 투자사 미팅이 겹쳐요",
        "회사·Outlook 캘린더 충돌 · 금 15:00 제안",
        {
          subject: "Re: 투자 미팅 목요일 → 금요일?",
          from: "Mark Chen <mark@capital.example>",
          ago: 138,
          accountId: "inbox-outlook",
        },
      ),
    );
    tiers.QUEUE.push(
      attention(
        now,
        "att-queue-1",
        "QUEUE",
        "김도윤 님의 포트폴리오 피드백 요청",
        "답장 필요 · 급하지 않음",
        {
          subject: "포트폴리오 피드백 부탁드려요",
          from: "김도윤 <doyun@example.com>",
          ago: 960,
          needsReply: true,
        },
      ),
    );
    tiers.INFO.push(
      attention(now, "att-info-1", "INFO", "쿠팡이츠 배달 완료", "영수증 · 답장 불필요", {
        subject: "주문하신 음식이 배달 완료됐어요",
        from: "쿠팡이츠 <no-reply@coupangeats.example>",
        ago: 153,
      }),
    );
  }
  const count = (tier: Tier) => tiers[tier].length;
  return {
    tiers,
    summary: {
      PUSH: count("PUSH"),
      MEETING: count("MEETING"),
      QUEUE: count("QUEUE"),
      INFO: count("INFO"),
      SILENT: count("SILENT"),
      AUTO: 0,
      total: Object.values(tiers).reduce((n, list) => n + list.length, 0),
    },
  };
}

/** Today's events in Asia/Seoul relative to `now` (fixture clock: 10:28 KST). */
export function mockEvents(now: number, empty = false): CalendarEventWire[] {
  if (empty) return [];
  const at = (offsetMin: number, lengthMin: number) => ({
    startTime: iso(now, offsetMin),
    endTime: iso(now, offsetMin + lengthMin),
  });
  return [
    {
      id: "evt-standup",
      title: "팀 스탠드업",
      ...at(-88, 15),
      location: null,
      allDay: false,
      provider: "GOOGLE",
      sourceLabel: "회사 캘린더",
    },
    {
      id: "evt-review",
      title: "디자인 리뷰 — 모바일 v1",
      ...at(32, 60),
      location: null,
      meetingLink: "https://meet.google.com/abc-defg-hij",
      allDay: false,
      provider: "GOOGLE",
      sourceLabel: "회사 캘린더",
    },
    {
      id: "evt-investor",
      title: "투자사 미팅",
      ...at(212, 60),
      location: "강남 사무실",
      allDay: false,
      provider: "OUTLOOK",
      sourceLabel: "Outlook",
    },
    {
      id: "evt-1on1",
      title: "1:1 — 이하은",
      ...at(362, 30),
      location: null,
      meetingLink: "https://zoom.us/j/123456789",
      allDay: false,
      provider: "GOOGLE",
      sourceLabel: "회사 캘린더",
    },
  ];
}

export function mockPendingActions(now: number, empty = false): PendingActionWire[] {
  if (empty) return [];
  const base = {
    conversationId: "conv-1",
    conversationTitle: null,
    status: "PENDING",
    result: null,
  };
  return [
    {
      ...base,
      id: "pa-reply",
      toolName: "send_email",
      toolArgs: {
        to: "seoyeon@hanbitpartners.example",
        subject: "Re: 계약서 수정본 — 오늘 서명 가능할까요?",
        body: "서연님, 수정본 확인했습니다. 오늘 오후 4시 전에 서명해서 회신드릴게요.",
      },
      targetLabel: "박서연",
      reasoning: "“수정본 확인했습니다. 오늘 오후 4시 전에…”",
      createdAt: iso(now, -20),
    },
    {
      ...base,
      id: "pa-move",
      toolName: "schedule_meeting",
      toolArgs: {
        summary: "투자사 미팅 · Mark Chen",
        start_time: iso(now, 60 * 24 + 272),
        end_time: iso(now, 60 * 24 + 332),
        location: "강남 사무실",
      },
      targetLabel: "투자사 미팅을 금 15:00로",
      reasoning: "세 캘린더 모두 비어 있는 시간",
      createdAt: iso(now, -35),
    },
    {
      ...base,
      id: "pa-task",
      toolName: "create_task",
      toolArgs: { title: "계약서 서명", description: "오늘 18시 전, 3·7조 수정 확인 후" },
      targetLabel: "계약서 서명 할 일 추가",
      reasoning: "박서연 님 메일의 18시 마감",
      createdAt: iso(now, -50),
    },
  ];
}

function listItem(
  now: number,
  row: {
    id: string;
    from: string;
    subject: string;
    tier: LiveTier;
    ago: number;
    unread: boolean;
    inbox: string | null;
    summary: string;
  },
): EmailListItem {
  return {
    id: row.id,
    gmailId: `g-${row.id}`,
    threadId: `t-${row.id}`,
    linkedInboxAccountId: row.inbox,
    from: row.from,
    senderEmail: null,
    trust: null,
    tier: row.tier,
    to: MOCK_USER.email,
    subject: row.subject,
    snippet: row.summary,
    date: iso(now, -row.ago),
    labels: ["INBOX"],
    isRead: !row.unread,
    isStarred: false,
    priority: row.tier === "PUSH" ? "URGENT" : "NORMAL",
    category: null,
    summary: row.summary,
    keyPoints: [],
    actionItems: [],
    sentiment: null,
    needsReply: row.tier === "PUSH",
    attachmentCount: 0,
    attachmentCandidateCount: 0,
    attachmentPendingCount: 0,
    attachmentFallbackCount: 0,
    attachmentUnsupportedCount: 0,
    attachmentCategories: [],
    candidateProfilePreview: null,
    candidateIntake: null,
  };
}

export function mockEmailList(now: number, tier?: string): EmailListResponse {
  const rows = [
    {
      id: "email-att-push-1",
      from: "박서연 · 한빛파트너스",
      subject: "계약서 수정본 — 오늘 서명 가능할까요?",
      tier: "PUSH",
      ago: 106,
      unread: true,
      inbox: "inbox-work",
      summary: "오늘 18시 마감, 회신 기다림",
    },
    {
      id: "email-att-meet-1",
      from: "Mark Chen",
      subject: "Re: 투자 미팅 목요일 → 금요일?",
      tier: "MEETING",
      ago: 138,
      unread: true,
      inbox: "inbox-outlook",
      summary: "목 14:00 회사 일정과 겹침",
    },
    {
      id: "email-att-info-1",
      from: "쿠팡이츠",
      subject: "주문하신 음식이 배달 완료됐어요",
      tier: "INFO",
      ago: 153,
      unread: false,
      inbox: null,
      summary: "영수증 · 답장 불필요",
    },
    {
      id: "email-att-queue-1",
      from: "김도윤",
      subject: "포트폴리오 피드백 부탁드려요",
      tier: "QUEUE",
      ago: 960,
      unread: false,
      inbox: null,
      summary: "답장 필요 · 급하지 않음",
    },
    {
      id: "email-naverpay",
      from: "네이버페이",
      subject: "10월 결제 내역 안내",
      tier: "INFO",
      ago: 1224,
      unread: false,
      inbox: "inbox-naver",
      summary: "영수증 · 보관됨",
    },
  ] as const;
  const filtered = rows.filter((r) => !tier || tier === "ALL" || r.tier === tier);
  return {
    emails: filtered.map((r) => listItem(now, { ...r })),
    source: "gmail",
    total: filtered.length,
    unread: filtered.filter((r) => r.unread).length,
    page: 1,
  };
}

export function mockEmailDetail(now: number, id: string): EmailDetailWire | null {
  const row = mockEmailList(now).emails.find((e) => e.id === id);
  if (!row) return null;
  return {
    id: row.id,
    gmailId: row.gmailId,
    threadId: row.threadId,
    from: row.from,
    senderEmail: row.senderEmail,
    to: row.to,
    subject: row.subject,
    snippet: row.snippet,
    body: "지수님, 어제 말씀하신 3조와 7조 수정 반영했습니다. 오늘 18시까지 서명해 주시면 다음 주 월요일부터 진행 가능합니다.",
    date: row.date,
    isRead: row.isRead,
    isStarred: false,
    summary: row.summary,
    keyPoints: [],
    needsReply: row.needsReply,
    attachmentCount: 0,
    tier: row.tier,
  };
}
