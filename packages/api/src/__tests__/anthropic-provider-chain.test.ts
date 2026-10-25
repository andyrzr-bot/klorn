/**
 * The Anthropic provider is OFF until ANTHROPIC_API_KEY is set, and even then
 * it does not take traffic first unless the operator says so: with no
 * LLM_PROVIDER_ORDER it joins the END of the env chain (a failover lane only).
 * Flipping it to primary is a separate, deliberate env change.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Anthropic provider in the chain", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("OPENAI_COMPAT_BASE_URL", "");
    vi.stubEnv("OPENROUTER_API_KEY", "or-key");
    vi.stubEnv("GEMINI_API_KEY", "gm-key");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("LLM_PROVIDER_ORDER", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function load() {
    return await import("../providers/index.js");
  }

  async function chainNames(credentials = {}): Promise<string[]> {
    const { getProviderChain } = await load();
    return getProviderChain(credentials).map((p) => p.name);
  }

  it("is absent without ANTHROPIC_API_KEY — the chain is unchanged", async () => {
    expect(await chainNames()).toEqual(["openrouter", "gemini"]);
  });

  it("joins the END of the env chain when the key is set and no order is given", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "an-key");
    expect(await chainNames()).toEqual(["openrouter", "gemini", "anthropic"]);
  });

  it("follows LLM_PROVIDER_ORDER, appending configured providers it does not list", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "an-key");
    vi.stubEnv("LLM_PROVIDER_ORDER", "anthropic,gemini");
    expect(await chainNames()).toEqual(["anthropic", "gemini", "openrouter"]);
  });

  it("ignores unknown, duplicate and unconfigured names in LLM_PROVIDER_ORDER", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "an-key");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("LLM_PROVIDER_ORDER", " Anthropic , bogus, anthropic, openrouter ");
    expect(await chainNames()).toEqual(["anthropic", "gemini"]);
  });

  it("can be the only provider", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "an-key");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(await chainNames()).toEqual(["anthropic"]);
  });

  it("keeps a user's own (BYOK) keys ahead of it and the local provider at its edge", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "an-key");
    vi.stubEnv("LLM_PROVIDER_ORDER", "anthropic");
    vi.stubEnv("OPENAI_COMPAT_BASE_URL", "http://localhost:11434/v1");
    vi.stubEnv("OPENAI_COMPAT_PRIORITY", "last");
    expect(await chainNames({ geminiApiKey: "user-gm", quotaScope: "u1" })).toEqual([
      "gemini", // the user's own key
      "anthropic",
      "openrouter",
      "gemini",
      "openai-compat",
    ]);
  });

  it("never reaches a public playground visitor", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "an-key");
    vi.stubEnv("LLM_PROVIDER_ORDER", "anthropic");
    expect(await chainNames({ openRouterApiKey: "visitor", playgroundOnly: true })).toEqual([
      "openrouter",
    ]);
  });

  it("serves non-Claude pins with ANTHROPIC_MODEL (default claude-haiku-5-5) and supports tools", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "an-key");
    let provider = (await load()).getProvider("anthropic");
    expect(provider?.quotaKey).toBe("anthropic:env");
    expect(provider?.supportsTools).toBe(true);
    expect(provider?.client).toBeNull();
    expect(provider?.resolveModel("google/gemini-2.5-flash")).toBe("claude-haiku-5-5");
    expect(provider?.resolveModel("claude-sonnet-5-5")).toBe("claude-sonnet-5-5");

    vi.resetModules();
    vi.stubEnv("ANTHROPIC_MODEL", "claude-sonnet-5-5");
    provider = (await load()).getProvider("anthropic");
    expect(provider?.resolveModel("google/gemini-2.5-flash")).toBe("claude-sonnet-5-5");
  });
});

describe("resolveEnvProviderOrder", () => {
  it("defaults to openrouter, gemini, anthropic", async () => {
    const { resolveEnvProviderOrder } = await import("../providers/index.js");
    expect(resolveEnvProviderOrder(undefined)).toEqual(["openrouter", "gemini", "anthropic"]);
    expect(resolveEnvProviderOrder("")).toEqual(["openrouter", "gemini", "anthropic"]);
  });

  it("reports the names it ignored", async () => {
    const { unknownEnvProviderNames } = await import("../providers/index.js");
    expect(unknownEnvProviderNames("anthropic, opnerouter,,gemini")).toEqual(["opnerouter"]);
  });
});
