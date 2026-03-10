import { describe, expect, test } from "bun:test";

import { ArenaClient } from "../../.agents/skills/arena-api-operator/scripts/lib/client.ts";
import { ArenaHttpError } from "../../.agents/skills/arena-api-operator/scripts/lib/errors.ts";
import { createMockFetch, jsonResponse, makeArenaEnv, writeTempFile } from "../test-helpers.ts";

describe("ArenaClient.search", () => {
  test("serializes premium search params as Are.na expects", async () => {
    const { fetch, calls } = createMockFetch([
      {
        match: (url) => url.startsWith("https://api.are.na/v3/search"),
        response: jsonResponse({ data: [], meta: { current_page: 1, per_page: 12, total_pages: 1, total_count: 0, has_more_pages: false } })
      }
    ]);
    const client = new ArenaClient(makeArenaEnv(), { fetch });

    await client.search({
      query: "brutalism",
      type: ["Image", "Link"],
      ext: ["pdf", "jpg"],
      scope: "my",
      channel_id: 9,
      page: 2,
      per: 12
    });

    const parsed = new URL(calls[0]?.url || "");
    expect(`${parsed.origin}${parsed.pathname}`).toBe("https://api.are.na/v3/search");
    expect(parsed.searchParams.get("query")).toBe("brutalism");
    expect(parsed.searchParams.get("type")).toBe("Image,Link");
    expect(parsed.searchParams.get("ext")).toBe("pdf,jpg");
    expect(parsed.searchParams.get("scope")).toBe("my");
    expect(parsed.searchParams.get("channel_id")).toBe("9");
    expect(parsed.searchParams.get("page")).toBe("2");
    expect(parsed.searchParams.get("per")).toBe("12");
  });
});

describe("ArenaClient.uploadLocalFile", () => {
  test("presigns and uploads a local file", async () => {
    const filePath = await writeTempFile("hello upload", ".pdf");
    const { fetch, calls } = createMockFetch([
      {
        match: (url, init) => url === "https://api.are.na/v3/uploads/presign" && init.method === "POST",
        response: jsonResponse({
          files: [
            {
              upload_url: "https://upload.example.com/object",
              key: "uploads/abc/file.pdf",
              content_type: "application/pdf"
            }
          ],
          expires_in: 3600
        }, 201)
      },
      {
        match: (url, init) => url === "https://upload.example.com/object" && init.method === "PUT",
        response: new Response(null, { status: 200 })
      }
    ]);
    const client = new ArenaClient(makeArenaEnv(), { fetch });

    const result = await client.uploadLocalFile(filePath);

    expect(result.storageUrl).toBe("https://s3.amazonaws.com/arena_images-temp/uploads/abc/file.pdf");
    expect(calls).toHaveLength(2);
  });

  test("surfaces API errors as ArenaHttpError", async () => {
    const { fetch } = createMockFetch([
      {
        match: (url) => url === "https://api.are.na/v3/me",
        response: jsonResponse({ error: "Unauthorized", details: { message: "Bad token" } }, 401)
      }
    ]);
    const client = new ArenaClient(makeArenaEnv(), { fetch });

    await expect(client.getCurrentUser()).rejects.toThrow(ArenaHttpError);
  });
});
