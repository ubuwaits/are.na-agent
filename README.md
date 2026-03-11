# Are.na Agent

Are.na agent which can create and edit content within your owned channels. Designed to be run completely inside Codex.

## Example usage
```
- Look through my channels to understand my current interests and content
- Then, create a new private channel and connect other user's channels into it that might be of interest to me
```

## Requirements
- Bun 1.3+
- An Are.na personal access token with `write` scope
- Premium Are.na access if you want global search and private batch imports

## Setup
1. Clone this repo and open in Codex
2. Copy `.env.example` to `.env`.
3. Set `ARENA_ACCESS_TOKEN`. (Create one here: https://www.are.na/settings/personal-access-tokens)
4. Run `bun test` to verify the workspace.

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
