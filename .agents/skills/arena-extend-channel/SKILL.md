---
name: arena-extend-channel
description: Extend an existing Are.na channel that the authenticated user can add to. Use when a user wants Codex to inspect a channel they own or collaborate on, infer the channel motif, find complementary web and Premium Are.na content, and append it through $arena-api-operator.
---

# Arena Extend Channel

## Overview

Use this skill when the channel already exists. Read the channel first, infer the motif if needed, plan additions with `$arena-curation-common`, and then execute through `$arena-api-operator`.

## Workflow

1. Read [references/workflow.md](references/workflow.md).
2. Run `channel-get` and `channel-contents --per 24` before planning additions.
3. Require `can.add_to = true` before attempting any manifest execution.
4. If the motif is unclear, inspect another page of contents or use Premium `search` scoped to the channel or adjacent theme.
5. Build 6 complementary items by default.
6. Prefer additions that deepen or interestingly bend the existing motif instead of repeating the same source pattern.
7. Execute with `apply-manifest`, and use `--dry-run` only when the user explicitly wants preview-first behavior.

## Output

- Report what was added, what was skipped as a duplicate, and any API failures.
- Mention the inferred motif if the user did not provide one explicitly.

## References

- Existing-channel workflow details: [references/workflow.md](references/workflow.md)
- Shared manifest and curation rules: use `$arena-curation-common`
- Deterministic execution and API reads/writes: use `$arena-api-operator`
