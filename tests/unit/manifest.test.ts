import { describe, expect, test } from "bun:test";

import {
  assertCanAddToChannel,
  candidateToBlockInput,
  dedupeCandidates,
  validateManifest
} from "../../.agents/skills/arena-api-operator/scripts/lib/manifest.ts";
import { ArenaValidationError } from "../../.agents/skills/arena-api-operator/scripts/lib/errors.ts";

describe("validateManifest", () => {
  test("fills defaults for create mode", () => {
    const manifest = validateManifest({
      mode: "create",
      theme: "weird internet gardens",
      items: [{ kind: "text", value: "A note" }]
    });

    expect(manifest.channel?.title).toBe("weird internet gardens");
    expect(manifest.channel?.visibility).toBe("closed");
    expect(manifest.execution_mode).toBe("auto");
  });

  test("requires a target channel for extend mode", () => {
    expect(() =>
      validateManifest({
        mode: "extend",
        theme: "x",
        items: [{ kind: "text", value: "A note" }]
      })
    ).toThrow(ArenaValidationError);
  });
});

describe("candidateToBlockInput", () => {
  test("maps text and URL candidates to block payloads", () => {
    expect(candidateToBlockInput({ kind: "text", value: "hello", title: "Greeting" })).toEqual({
      value: "hello",
      title: "Greeting",
      description: undefined,
      original_source_url: undefined,
      original_source_title: undefined,
      alt_text: undefined
    });

    expect(
      candidateToBlockInput({
        kind: "url",
        url: "https://example.com/watch?v=1",
        title: "Clip",
        alt_text: "still frame"
      })
    ).toEqual({
      value: "https://example.com/watch?v=1",
      title: "Clip",
      description: undefined,
      original_source_url: undefined,
      original_source_title: undefined,
      alt_text: "still frame"
    });
  });
});

describe("assertCanAddToChannel", () => {
  test("throws when the channel is not addable", () => {
    expect(() =>
      assertCanAddToChannel({
        id: 1,
        type: "Channel",
        slug: "blocked",
        title: "Blocked",
        visibility: "closed",
        owner: { id: 1, type: "User", name: "Test", slug: "test" },
        can: { add_to: false, update: false, destroy: false, manage_collaborators: false }
      })
    ).toThrow(ArenaValidationError);
  });
});

describe("dedupeCandidates", () => {
  test("drops duplicate web, text, and existing Are.na candidates", async () => {
    const { unique, skipped } = await dedupeCandidates(
      [
        { kind: "url", url: "https://example.com/story?utm_source=feed", title: "Story" },
        { kind: "url", url: "https://example.com/story", title: "Story" },
        { kind: "text", value: "Hello world", title: "Quote" },
        { kind: "text", value: "Hello   world", title: "Quote" },
        { kind: "existing", connectable_id: 42, connectable_type: "Block" },
        { kind: "existing", connectable_id: 42, connectable_type: "Block" }
      ],
      new Set(["connectable:Block:99"])
    );

    expect(unique).toHaveLength(3);
    expect(skipped).toHaveLength(3);
  });
});
