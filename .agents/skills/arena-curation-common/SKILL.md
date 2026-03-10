---
name: arena-curation-common
description: Shared Are.na curation guidance for theme inference, source selection, mixed-content planning, manifest construction, and dedupe-aware sequencing. Use when Codex needs to decide what belongs in a new or existing Are.na channel before handing execution to $arena-api-operator.
---

# Arena Curation Common

## Overview

Use this skill to plan content, not to execute API writes. Infer the theme, assemble an Are.na-native mix of material, and emit a `ChannelCurationManifest` that `$arena-api-operator` can apply without further decisions.

## Workflow

1. Read [references/style-guide.md](references/style-guide.md) for the desired tone and mix.
2. Read [references/manifest-schema.md](references/manifest-schema.md) before writing a manifest.
3. Infer the theme from the user request or from the target channel's first page of contents.
4. Search both the web and Premium Are.na search when possible.
5. Build a mixed slate: mostly direct, some tangential, some playful, and not all from the same source tier.
6. Cover `Text`, `Image`, `Link`, `Attachment`, and `Embed` when feasible.
7. Emit valid JSON only when preparing a manifest for `$arena-api-operator`.

## Rules

- Default to 12 items for a new channel unless the user asks for a different count.
- Default to 6 items for extending an existing channel unless the user asks for a different count.
- Prefer complementary additions over redundant ones.
- Use `existing` manifest items for strong Are.na-native connections when Premium search surfaces relevant blocks or channels.
- Use `upload` manifest items only when the user actually provided local files.

## References

- Manifest schema: [references/manifest-schema.md](references/manifest-schema.md)
- Are.na-native content mix guidance: [references/style-guide.md](references/style-guide.md)
