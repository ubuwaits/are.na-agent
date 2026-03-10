---
name: arena-api-operator
description: Deterministic Are.na API operations for inspecting accounts and channels, running Premium search, creating channels and blocks, connecting existing Are.na content, uploading local files, and applying multi-item curation manifests through the repo Bun CLI. Use when Codex needs to read or mutate Are.na through the official API instead of reasoning-only workflows.
---

# Arena Api Operator

## Overview

Use this skill whenever Are.na work should be executed deterministically through the official API. Read through the shared Bun CLI, prefer JSON in and JSON out, and make this the only path that actually mutates Are.na state.

## Quick Start

1. Confirm `.env` contains `ARENA_ACCESS_TOKEN`.
2. Run the shared CLI at `bun run .agents/skills/arena-api-operator/scripts/arena.ts`.
3. Prefer `apply-manifest` for multi-item curation and the narrower subcommands for inspection, debugging, or one-off operations.

## Workflow

1. Read [references/cli-reference.md](references/cli-reference.md) before using a subcommand you have not used yet.
2. Use `me`, `channel-get`, `channel-contents`, and `search` to inspect Are.na state before writing.
3. Use `channel-create`, `channel-update`, `block-create`, `block-batch-create`, `connection-create`, and `upload-local-file` for targeted operations.
4. Use `apply-manifest --input <file>` for mixed curation workflows.
5. Use `apply-manifest --dry-run` when the user asks for a preview rather than immediate writes.
6. Return the CLI result as a concise summary, including created ids, skipped duplicates, and any failures.

## Rules

- Prefer the official CLI over ad hoc `curl` once the CLI can express the action.
- Use `search` as a first-class discovery source because Premium Are.na access is an accepted requirement.
- Use `block-batch-create` only for private channels and only when every pending operation is a block creation.
- Route local files through `upload-local-file` or manifest upload items so the presign flow stays correct.
- Keep JSON payloads minimal and omit unset fields.

## References

- CLI usage and manifest execution details: [references/cli-reference.md](references/cli-reference.md)
- Shared curation rules and manifest schema: use `$arena-curation-common`
