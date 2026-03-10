# Are.na Agent

Codex-native Are.na channel curation built from repo-local skills plus a shared Bun CLI.

## Requirements

- Bun 1.3+
- An Are.na personal access token with `write` scope
- Premium Are.na access if you want global search and private batch imports

## Setup

1. Copy `.env.example` to `.env`.
2. Set `ARENA_ACCESS_TOKEN`.
3. Run `bun test` to verify the workspace.

## CLI

The shared CLI lives behind the API skill entrypoint:

```bash
bun run .agents/skills/arena-api-operator/scripts/arena.ts me
bun run .agents/skills/arena-api-operator/scripts/arena.ts search --query brutalism --type Image,Link --per 12
bun run .agents/skills/arena-api-operator/scripts/arena.ts apply-manifest --input manifest.json
```

## Skills

- `.agents/skills/arena-create-channel`
- `.agents/skills/arena-extend-channel`
- `.agents/skills/arena-curation-common`
- `.agents/skills/arena-api-operator`
