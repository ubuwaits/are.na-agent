---
name: arena-create-channel
description: Create and populate a new Are.na channel from a theme. Use when a user wants Codex to invent or refine a channel title and description, research web and Premium Are.na content, build a mixed Are.na-style slate, and immediately create the channel through $arena-api-operator.
---

# Arena Create Channel

## Overview

Use this skill for net-new channels only. Plan the curation with `$arena-curation-common`, then execute the final manifest through `$arena-api-operator`.

## Workflow

1. Read [references/workflow.md](references/workflow.md).
2. Use `$arena-curation-common` to decide the title, description, and candidate mix.
3. Default visibility to `closed` unless the user explicitly wants `public` or `private`.
4. Use web search plus Premium Are.na search to gather direct, tangential, and playful material.
5. Build a manifest with 12 items by default and include all supported block types when feasible.
6. Run `bun run .agents/skills/arena-api-operator/scripts/arena.ts apply-manifest --input <manifest-file>` for immediate creation.
7. Use `--dry-run` only when the user asked to preview before writing.

## Output

- Return the created channel id, slug, visibility, and a concise list of what was added.
- Call out any skipped duplicates or failed items.

## References

- New channel workflow details: [references/workflow.md](references/workflow.md)
- Shared manifest and curation rules: use `$arena-curation-common`
- Deterministic execution and API writes: use `$arena-api-operator`
