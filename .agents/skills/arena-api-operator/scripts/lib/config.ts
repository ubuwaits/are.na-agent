import { ArenaConfigError } from "./errors.ts";
import type { ArenaEnv } from "./types.ts";

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }

  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return value;
}

export function loadArenaEnv(env: Record<string, string | undefined> = process.env): ArenaEnv {
  const accessToken = env.ARENA_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new ArenaConfigError("Missing ARENA_ACCESS_TOKEN in the environment.");
  }

  return {
    accessToken,
    apiBaseUrl: (env.ARENA_API_BASE_URL?.trim() || "https://api.are.na").replace(/\/+$/, ""),
    batchPollIntervalMs: parsePositiveInt(env.ARENA_BATCH_POLL_INTERVAL_MS, 500),
    batchPollTimeoutMs: parsePositiveInt(env.ARENA_BATCH_POLL_TIMEOUT_MS, 30_000),
    writeDelayMs: parsePositiveInt(env.ARENA_WRITE_DELAY_MS, 250)
  };
}
