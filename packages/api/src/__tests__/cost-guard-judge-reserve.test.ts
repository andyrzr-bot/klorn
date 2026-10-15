import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The judge must not be starved by the rest of the product.
 *
 * 2026-10-15: an OpenRouter top-up brought the LLM back at 22:07. By 22:28 the
 * founder's account had spent 101¢ against a 100¢ daily cap — almost all of it
 * chat/agent traffic on claude-sonnet-5 ($2.00/M against gemini-2.5-flash's
 * $0.30/M). The cost guard then blocked every paid call for the rest of the
 * UTC day, and the judge degraded to the keyword fallback, which structurally
 * cannot emit PUSH. The one lane the product is sold on went dark because a
 * side surface spent the budget first.
 *
 * `priority: "background"` already existed and is documented as stopping
 * background work from starving chat. It is wired to the concurrency pacer
 * only — `cost-guard.ts` never reads it — so there was no budget protection in
 * either direction, let alone for the judge.
 *
 * A reserved slice fixes the direction that matters: ordinary calls stop at
 * `cap - reserve`; calls marked reserved may use the whole cap.
 */

let mockRow: { cents: number } | null = null;
let mockUser: { plan: string; role: string | null } | null = null;

vi.mock("../db.js", () => ({
  prisma: {
    user: { findUnique: vi.fn(async () => mockUser) },
    llmCostLedger: { findUnique: vi.fn(async () => mockRow) },
    globalCostLedger: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => ({})) },
  },
}));

vi.mock("../sentry.js", () => ({ captureError: vi.fn() }));
vi.mock("../billing/cost-trip-alert.js", () => ({ notifyCostCapTrip: vi.fn() }));

const ENV = [
  "DAILY_COST_CAP_CENTS",
  "FREE_DAILY_COST_CAP_CENTS",
  "JUDGE_BUDGET_RESERVE_CENTS",
  "PAYWALL_ENABLED",
] as const;
const ORIGINAL: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV) ORIGINAL[k] = process.env[k];
  vi.resetModules();
});

afterEach(() => {
  for (const k of ENV) {
    if (ORIGINAL[k] === undefined) delete process.env[k];
    else process.env[k] = ORIGINAL[k];
  }
  mockRow = null;
  mockUser = null;
  vi.restoreAllMocks();
});

async function gate(opts?: { reserved?: boolean }) {
  const { checkCostGate } = await import("../billing/cost-guard.js");
  return checkCostGate("user-1", opts);
}

describe("judge budget reserve", () => {
  beforeEach(() => {
    process.env.DAILY_COST_CAP_CENTS = "100";
    process.env.JUDGE_BUDGET_RESERVE_CENTS = "25";
    delete process.env.PAYWALL_ENABLED;
  });

  it("lets ordinary calls spend up to the cap minus the reserve", async () => {
    mockRow = { cents: 74 };
    const result = await gate();
    expect(result.allowed).toBe(true);
    expect(result.remainingCents).toBe(1);
  });

  // The exact 2026-10-15 shape: chat has eaten everything it is allowed to.
  it("blocks ordinary calls once the unreserved budget is gone", async () => {
    mockRow = { cents: 75 };
    const result = await gate();
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/75/);
  });

  it("still admits a reserved call at that point — this is the whole fix", async () => {
    mockRow = { cents: 75 };
    const result = await gate({ reserved: true });
    expect(result.allowed).toBe(true);
    expect(result.remainingCents).toBe(25);
  });

  it("blocks a reserved call only at the real cap", async () => {
    mockRow = { cents: 100 };
    await expect(gate({ reserved: true })).resolves.toMatchObject({ allowed: false });
  });

  it("reports the cap it actually enforced, so logs are not misleading", async () => {
    mockRow = { cents: 10 };
    await expect(gate()).resolves.toMatchObject({ capCents: 75 });
    await expect(gate({ reserved: true })).resolves.toMatchObject({ capCents: 100 });
  });
});

describe("judge budget reserve — edges", () => {
  beforeEach(() => {
    delete process.env.PAYWALL_ENABLED;
  });

  it("is off by default, so nothing changes for anyone who does not set it", async () => {
    process.env.DAILY_COST_CAP_CENTS = "100";
    delete process.env.JUDGE_BUDGET_RESERVE_CENTS;
    mockRow = { cents: 99 };
    await expect(gate()).resolves.toMatchObject({ allowed: true });
  });

  // A reserve at or above the cap would leave ordinary calls nothing at all —
  // a misconfiguration that would read as "chat is broken", not "reserve is
  // too big". Clamp instead of handing someone a dead product.
  it("clamps a reserve that would starve everything else", async () => {
    process.env.DAILY_COST_CAP_CENTS = "100";
    process.env.JUDGE_BUDGET_RESERVE_CENTS = "500";
    mockRow = { cents: 0 };
    const result = await gate();
    expect(result.allowed).toBe(true);
    expect(result.capCents).toBeGreaterThan(0);
  });

  it("leaves the cap-disabled escape hatch alone", async () => {
    process.env.DAILY_COST_CAP_CENTS = "0";
    process.env.JUDGE_BUDGET_RESERVE_CENTS = "25";
    mockRow = { cents: 9999 };
    await expect(gate()).resolves.toMatchObject({ allowed: true });
    await expect(gate({ reserved: true })).resolves.toMatchObject({ allowed: true });
  });

  // The free tier's whole cap is 10¢; a 25¢ reserve must not invert it.
  it("does not invert the free-tier cap", async () => {
    process.env.PAYWALL_ENABLED = "true";
    process.env.DAILY_COST_CAP_CENTS = "100";
    process.env.FREE_DAILY_COST_CAP_CENTS = "10";
    process.env.JUDGE_BUDGET_RESERVE_CENTS = "25";
    mockUser = { plan: "FREE", role: null };
    mockRow = { cents: 0 };
    const result = await gate();
    expect(result.allowed).toBe(true);
    expect(result.capCents).toBeGreaterThan(0);
    expect(result.capCents).toBeLessThanOrEqual(10);
  });
});

describe("the judge is actually wired to the reserve", () => {
  // A reserve nothing opts into protects nothing. This asserts the wiring,
  // not the arithmetic: the judge's own call site must mark itself reserved,
  // and CompletionOptions must carry it.
  it("poc-judge marks its completion call reserved", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../judge/poc-judge.ts", import.meta.url), "utf8");
    expect(src).toMatch(/reserved:\s*true/);
  });

  it("no other surface claims the reserve", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const root = new URL("..", import.meta.url).pathname;
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
          if (entry === "__tests__" || entry === "node_modules") continue;
          walk(path);
          continue;
        }
        if (!entry.endsWith(".ts")) continue;
        // The judge may claim it; openai.ts and cost-guard.ts define it.
        if (path.includes("judge/poc-judge.ts")) continue;
        if (path.includes("llm/openai.ts") || path.includes("billing/cost-guard.ts")) continue;
        if (/reserved:\s*true/.test(readFileSync(path, "utf8"))) offenders.push(path);
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
