import { describe, expect, test } from "bun:test";

import { normalizeUrl } from "../../.agents/skills/arena-api-operator/scripts/lib/normalize.ts";

describe("normalizeUrl", () => {
  test("strips hashes, tracking params, and trailing slashes", () => {
    expect(normalizeUrl("https://Example.com/path/?utm_source=newsletter&gclid=123&b=2#a")).toBe(
      "https://example.com/path?b=2"
    );
  });

  test("returns null for invalid URLs", () => {
    expect(normalizeUrl("not a valid url")).toBeNull();
  });
});
