import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ArenaEnv } from "../.agents/skills/arena-api-operator/scripts/lib/types.ts";

export interface MockCall {
  url: string;
  init: RequestInit;
}

export interface MockRoute {
  match: (url: string, init: RequestInit) => boolean;
  response:
    | Response
    | ((url: string, init: RequestInit) => Response | Promise<Response>);
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...headers
    }
  });
}

export function textResponse(body: string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers });
}

export function createMockFetch(routes: MockRoute[]): { fetch: typeof fetch; calls: MockCall[] } {
  const calls: MockCall[] = [];

  const fetch: typeof globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const requestInit = init || {};
    calls.push({ url, init: requestInit });

    for (const route of routes) {
      if (route.match(url, requestInit)) {
        return typeof route.response === "function" ? await route.response(url, requestInit) : route.response.clone();
      }
    }

    throw new Error(`Unexpected request: ${(requestInit.method || "GET").toUpperCase()} ${url}`);
  };

  return { fetch, calls };
}

export function makeArenaEnv(overrides: Partial<ArenaEnv> = {}): ArenaEnv {
  return {
    accessToken: "test-token",
    apiBaseUrl: "https://api.are.na",
    batchPollIntervalMs: 1,
    batchPollTimeoutMs: 250,
    writeDelayMs: 0,
    ...overrides
  };
}

export async function writeTempFile(contents: string, extension = ".txt"): Promise<string> {
  const path = join(tmpdir(), `${crypto.randomUUID()}${extension}`);
  await Bun.write(path, contents);
  return path;
}
