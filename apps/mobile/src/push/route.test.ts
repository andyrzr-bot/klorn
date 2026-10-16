import { describe, expect, it } from "vitest";
import { intentOf, PUSH_ACTIONS, routeFromPush, routeFromWebPath } from "./route";

describe("push routing", () => {
  it("maps the server's web paths to app routes", () => {
    expect(routeFromWebPath("/email/abc-123")).toEqual({ name: "mail", id: "abc-123" });
    expect(routeFromWebPath("/inbox/firewall")).toEqual({ name: "mail", lane: "PUSH" });
    expect(routeFromWebPath("/briefing")).toEqual({ name: "assistant", section: "briefing" });
    expect(routeFromWebPath("/chat")).toEqual({ name: "assistant", section: "chat" });
    expect(routeFromWebPath("/inbox")).toEqual({ name: "assistant", section: "approvals" });
    expect(routeFromWebPath("/nowhere")).toEqual({ name: "today" });
  });

  it("prefers an app route, then the approval, then the mail, then the web url", () => {
    expect(routeFromPush({ route: "/calendar/evt-1", url: "/chat" })).toEqual({
      name: "calendar",
      id: "evt-1",
    });
    expect(routeFromPush({ pendingActionId: "pa-1", emailId: "e1" })).toEqual({
      name: "assistant",
      section: "approvals",
      id: "pa-1",
    });
    expect(routeFromPush({ emailId: "e1", url: "/inbox/firewall" })).toEqual({
      name: "mail",
      id: "e1",
    });
    expect(routeFromPush({ url: "/email/e2" })).toEqual({ name: "mail", id: "e2" });
  });

  it("refuses malformed or foreign input", () => {
    expect(routeFromPush({ route: "//evil.example/x" })).toEqual({ name: "today" });
    expect(routeFromPush({ route: "https://evil.example" })).toEqual({ name: "today" });
    expect(routeFromPush({ emailId: "../../x" })).toEqual({ name: "today" });
    expect(routeFromPush(null)).toEqual({ name: "today" });
  });

  it("never turns 'Send draft' into a send", () => {
    expect(intentOf(PUSH_ACTIONS.send, { pendingActionId: "pa-1" })).toEqual({
      kind: "review",
      route: { name: "assistant", section: "approvals", id: "pa-1" },
    });
    expect(intentOf(PUSH_ACTIONS.later, { attentionItemId: "att-1", emailId: "e" })).toMatchObject({
      kind: "snooze",
      attentionItemId: "att-1",
    });
    expect(intentOf(PUSH_ACTIONS.done, { emailId: "e" })).toEqual({
      kind: "open",
      route: { name: "mail", id: "e" },
    });
    expect(intentOf("tap", { url: "/chat" }).kind).toBe("open");
  });
});
