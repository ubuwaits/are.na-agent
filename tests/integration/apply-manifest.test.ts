import { describe, expect, test } from "bun:test";

import { applyManifest } from "../../.agents/skills/arena-api-operator/scripts/lib/apply-manifest.ts";
import { ArenaClient } from "../../.agents/skills/arena-api-operator/scripts/lib/client.ts";
import { createMockFetch, jsonResponse, makeArenaEnv, writeTempFile } from "../test-helpers.ts";

describe("applyManifest", () => {
  test("creates a channel and applies web, upload, and existing-content items", async () => {
    const uploadPath = await writeTempFile("pdf bytes", ".pdf");
    const { fetch } = createMockFetch([
      {
        match: (url, init) => url === "https://api.are.na/v3/channels" && init.method === "POST",
        response: jsonResponse(
          {
            id: 100,
            type: "Channel",
            slug: "field-notes",
            title: "Field Notes",
            visibility: "closed",
            owner: { id: 1, type: "User", name: "Chad", slug: "chad" },
            can: { add_to: true, update: true, destroy: true, manage_collaborators: true }
          },
          201
        )
      },
      {
        match: (url) => url === "https://api.are.na/v3/channels/100/contents?per=24&sort=position_asc",
        response: jsonResponse({
          data: [],
          meta: { current_page: 1, per_page: 24, total_pages: 1, total_count: 0, has_more_pages: false }
        })
      },
      {
        match: (url, init) => url === "https://api.are.na/v3/blocks" && init.method === "POST",
        response: (url, init) => {
          const body = JSON.parse(String(init.body));
          return jsonResponse(
            {
              id: body.value.includes("s3.amazonaws.com") ? 201 : body.value.startsWith("http") ? 200 : 199,
              base_type: "Block",
              type: body.value.startsWith("http") ? "Link" : "Text",
              title: body.title || null,
              source: body.value.startsWith("http") ? { url: body.value } : null
            },
            201
          );
        }
      },
      {
        match: (url, init) => url === "https://api.are.na/v3/uploads/presign" && init.method === "POST",
        response: jsonResponse(
          {
            files: [
              {
                upload_url: "https://uploads.example.com/upload-1",
                key: "uploads/1/file.pdf",
                content_type: "application/pdf"
              }
            ],
            expires_in: 3600
          },
          201
        )
      },
      {
        match: (url, init) => url === "https://uploads.example.com/upload-1" && init.method === "PUT",
        response: new Response(null, { status: 200 })
      },
      {
        match: (url, init) => url === "https://api.are.na/v3/connections" && init.method === "POST",
        response: jsonResponse({ data: [{ id: 501, position: 4 }] }, 201)
      }
    ]);
    const client = new ArenaClient(makeArenaEnv(), { fetch });

    const result = await applyManifest(client, {
      mode: "create",
      theme: "Field Notes",
      channel: { title: "Field Notes", visibility: "closed" },
      items: [
        { kind: "text", value: "A short note", title: "Note" },
        { kind: "url", url: "https://example.com/article", title: "Article" },
        { kind: "upload", path: uploadPath, title: "Scan" },
        { kind: "existing", connectable_id: 88, connectable_type: "Block", title: "Existing block" }
      ]
    });

    expect(result.created_channel?.id).toBe(100);
    expect(result.execution_mode).toBe("single");
    expect(result.applied_items).toHaveLength(4);
    expect(result.failures).toHaveLength(0);
  });

  test("uses batch create for private block-only imports and polls for completion", async () => {
    const { fetch, calls } = createMockFetch([
      {
        match: (url) => url === "https://api.are.na/v3/channels/private-room",
        response: jsonResponse({
          id: 200,
          type: "Channel",
          slug: "private-room",
          title: "Private Room",
          visibility: "private",
          owner: { id: 1, type: "User", name: "Chad", slug: "chad" },
          can: { add_to: true, update: true, destroy: true, manage_collaborators: true }
        })
      },
      {
        match: (url) => url === "https://api.are.na/v3/channels/200/contents?per=24&sort=position_asc",
        response: jsonResponse({
          data: [],
          meta: { current_page: 1, per_page: 24, total_pages: 1, total_count: 0, has_more_pages: false }
        })
      },
      {
        match: (url, init) => url === "https://api.are.na/v3/blocks/batch" && init.method === "POST",
        response: jsonResponse({ batch_id: "batch-1", status: "pending", total: 2 }, 202)
      },
      {
        match: (url) => url === "https://api.are.na/v3/blocks/batch/batch-1",
        response: (() => {
          let count = 0;
          return () => {
            count += 1;
            if (count === 1) {
              return jsonResponse({
                batch_id: "batch-1",
                status: "processing",
                total: 2,
                successful_count: 0,
                failed_count: 0
              });
            }
            return jsonResponse({
              batch_id: "batch-1",
              status: "completed",
              total: 2,
              successful_count: 2,
              failed_count: 0,
              successful: [
                { index: 0, block_id: 900 },
                { index: 1, block_id: 901 }
              ]
            });
          };
        })()
      }
    ]);
    const client = new ArenaClient(makeArenaEnv({ batchPollIntervalMs: 1, batchPollTimeoutMs: 50 }), { fetch, sleep: async () => {} });

    const result = await applyManifest(client, {
      mode: "extend",
      theme: "Private import",
      target_channel: "private-room",
      items: [
        { kind: "text", value: "First note", title: "First" },
        { kind: "url", url: "https://example.com/video", title: "Video" }
      ]
    });

    expect(result.execution_mode).toBe("batch");
    expect(result.batch?.status).toBe("completed");
    expect(calls.some((call) => call.url === "https://api.are.na/v3/blocks/batch")).toBeTrue();
    expect(calls.some((call) => call.url === "https://api.are.na/v3/blocks")).toBeFalse();
  });

  test("dedupes against existing channel content and aborts on rate limits", async () => {
    const { fetch } = createMockFetch([
      {
        match: (url) => url === "https://api.are.na/v3/channels/closed-room",
        response: jsonResponse({
          id: 300,
          type: "Channel",
          slug: "closed-room",
          title: "Closed Room",
          visibility: "closed",
          owner: { id: 1, type: "User", name: "Chad", slug: "chad" },
          can: { add_to: true, update: true, destroy: true, manage_collaborators: true }
        })
      },
      {
        match: (url) => url === "https://api.are.na/v3/channels/300/contents?per=24&sort=position_asc",
        response: jsonResponse({
          data: [
            {
              id: 1,
              base_type: "Block",
              type: "Link",
              title: "Story",
              source: { url: "https://example.com/story" }
            }
          ],
          meta: { current_page: 1, per_page: 24, total_pages: 1, total_count: 1, has_more_pages: false }
        })
      },
      {
        match: (url, init) => url === "https://api.are.na/v3/blocks" && init.method === "POST",
        response: jsonResponse({ error: "Rate Limited", details: { message: "Slow down" } }, 429)
      }
    ]);
    const client = new ArenaClient(makeArenaEnv(), { fetch });

    const result = await applyManifest(client, {
      mode: "extend",
      theme: "Closed room",
      target_channel: "closed-room",
      items: [
        { kind: "url", url: "https://example.com/story?utm_source=rss", title: "Story" },
        { kind: "text", value: "Fresh note", title: "New note" },
        { kind: "text", value: "Another note", title: "Second note" }
      ]
    });

    expect(result.execution_mode).toBe("single");
    expect(result.skipped_duplicates).toHaveLength(1);
    expect(result.failures).toHaveLength(1);
    expect(result.applied_items).toHaveLength(0);
  });

  for (const status of [401, 403] as const) {
    test(`aborts immediately on ${status} write failures`, async () => {
      const { fetch } = createMockFetch([
        {
          match: (url) => url === "https://api.are.na/v3/channels/auth-test",
          response: jsonResponse({
            id: 400,
            type: "Channel",
            slug: "auth-test",
            title: "Auth Test",
            visibility: "closed",
            owner: { id: 1, type: "User", name: "Chad", slug: "chad" },
            can: { add_to: true, update: true, destroy: true, manage_collaborators: true }
          })
        },
        {
          match: (url) => url === "https://api.are.na/v3/channels/400/contents?per=24&sort=position_asc",
          response: jsonResponse({
            data: [],
            meta: { current_page: 1, per_page: 24, total_pages: 1, total_count: 0, has_more_pages: false }
          })
        },
        {
          match: (url, init) => url === "https://api.are.na/v3/blocks" && init.method === "POST",
          response: jsonResponse(
            {
              error: status === 401 ? "Unauthorized" : "Forbidden",
              details: { message: status === 401 ? "Bad token" : "Cannot add to channel" }
            },
            status
          )
        }
      ]);
      const client = new ArenaClient(makeArenaEnv(), { fetch });

      const result = await applyManifest(client, {
        mode: "extend",
        theme: "Auth test",
        target_channel: "auth-test",
        items: [
          { kind: "text", value: "First note", title: "First" },
          { kind: "text", value: "Second note", title: "Second" }
        ]
      });

      expect(result.failures).toHaveLength(1);
      expect(result.applied_items).toHaveLength(0);
    });
  }
});
