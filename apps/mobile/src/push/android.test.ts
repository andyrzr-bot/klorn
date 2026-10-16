import { describe, expect, it } from "vitest";
import {
  ACTION_CATEGORIES,
  ANDROID_CHANNELS,
  androidActionTypes,
  notificationIdOf,
  parseDataPush,
  STALE_AFTER_MS,
} from "./android";
import { intentOf, PUSH_ACTIONS } from "./route";

const NOW = Date.parse("2026-10-16T01:28:00Z");

const full = {
  title: "PUSH · 박서연",
  body: "계약서 오늘 18시 마감 — 답장 초안을 준비해 뒀어요.",
  category: "KLORN_PUSH_DRAFT",
  emailId: "email-att-push-1",
  attentionItemId: "att-1",
  pendingActionId: "pa-1",
  lane: "PUSH",
  sentAt: String(NOW - 5_000),
};

describe("Android data-only pushes", () => {
  it("posts a data-only Klorn message with the draft actions on the PUSH channel", () => {
    const push = parseDataPush({ data: full }, NOW);
    expect(push).toMatchObject({
      title: full.title,
      body: full.body,
      category: ACTION_CATEGORIES.withDraft,
      channelId: ANDROID_CHANNELS.push.id,
      data: { emailId: "email-att-push-1", attentionItemId: "att-1", pendingActionId: "pa-1" },
    });
    expect(push?.notificationId).toBe(notificationIdOf("att-1"));
  });

  it("leaves notification messages to the OS, and ignores empty or stale ones", () => {
    expect(parseDataPush({ title: "shown by FCM", data: full }, NOW)).toBeNull();
    expect(parseDataPush({ data: { ...full, title: "  " } }, NOW)).toBeNull();
    expect(parseDataPush({ data: { emailId: "e1" } }, NOW)).toBeNull();
    expect(
      parseDataPush({ data: { ...full, sentAt: String(NOW - STALE_AFTER_MS - 1) } }, NOW),
    ).toBeNull();
  });

  it("derives the action set when the server sends no category, and drops bad ids", () => {
    const plain = parseDataPush(
      { data: { title: "t", body: "b", attentionItemId: "att-2", emailId: "../x" } },
      NOW,
    );
    expect(plain?.category).toBe(ACTION_CATEGORIES.plain);
    expect(plain?.data).toEqual({ attentionItemId: "att-2" });
    expect(parseDataPush({ data: { title: "t", body: "b" } }, NOW)?.category).toBeNull();
    // The server's own NotifCategory values are not an action set.
    expect(
      parseDataPush({ data: { title: "t", body: "b", category: "system" } }, NOW)?.category,
    ).toBeNull();
  });

  it("puts only PUSH-lane mail on the high-importance channel", () => {
    expect(parseDataPush({ data: { ...full, lane: "MEETING" } }, NOW)?.channelId).toBe(
      ANDROID_CHANNELS.other.id,
    );
    expect(ANDROID_CHANNELS.push.importance).toBe(4); // NotificationManager.IMPORTANCE_HIGH
  });

  it("gives stable 31-bit positive notification ids", () => {
    const id = notificationIdOf("att-1");
    expect(id).toBe(notificationIdOf("att-1"));
    expect(id).not.toBe(notificationIdOf("att-2"));
    expect(id).toBeGreaterThan(0);
    expect(id).toBeLessThanOrEqual(2 ** 31 - 1);
  });

  it("shows 1시간 뒤에 · 처리 완료 · 검토하기, and Review never sends", () => {
    const types = androidActionTypes({
      later: "1시간 뒤에",
      done: "처리 완료",
      review: "검토하기",
    });
    for (const type of types) {
      expect(type.actions.map((a) => a.title)).toEqual(["1시간 뒤에", "처리 완료", "검토하기"]);
      expect(type.actions.map((a) => a.id)).not.toContain(PUSH_ACTIONS.send);
    }
    const data = parseDataPush({ data: full }, NOW)?.data;
    expect(intentOf(PUSH_ACTIONS.review, data)).toEqual({
      kind: "review",
      route: { name: "assistant", section: "approvals", id: "pa-1" },
    });
    expect(intentOf(PUSH_ACTIONS.later, data)).toMatchObject({
      kind: "snooze",
      attentionItemId: "att-1",
    });
    expect(intentOf(PUSH_ACTIONS.done, data)).toMatchObject({
      kind: "done",
      attentionItemId: "att-1",
    });
    // Review on a mail without a draft opens the mail.
    expect(intentOf(PUSH_ACTIONS.review, { emailId: "e1", attentionItemId: "att-1" })).toEqual({
      kind: "review",
      route: { name: "mail", id: "e1" },
    });
  });
});
