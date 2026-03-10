import { describe, expect, test } from "bun:test";

import { loadArenaEnv } from "../../.agents/skills/arena-api-operator/scripts/lib/config.ts";
import { ArenaConfigError } from "../../.agents/skills/arena-api-operator/scripts/lib/errors.ts";

describe("loadArenaEnv", () => {
  test("loads defaults when optional variables are missing", () => {
    const env = loadArenaEnv({ ARENA_ACCESS_TOKEN: "abc123" });

    expect(env).toEqual({
      accessToken: "abc123",
      apiBaseUrl: "https://api.are.na",
      batchPollIntervalMs: 500,
      batchPollTimeoutMs: 30000,
      writeDelayMs: 250
    });
  });

  test("throws when the token is missing", () => {
    expect(() => loadArenaEnv({})).toThrow(ArenaConfigError);
  });
});
