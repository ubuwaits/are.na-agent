# Are.na API Operator CLI

Use the shared CLI at `bun run .agents/skills/arena-api-operator/scripts/arena.ts`.

## Environment

- Read `.env` from the repo root.
- Require `ARENA_ACCESS_TOKEN`.
- Accept optional overrides:
  - `ARENA_API_BASE_URL`
  - `ARENA_BATCH_POLL_INTERVAL_MS`
  - `ARENA_BATCH_POLL_TIMEOUT_MS`
  - `ARENA_WRITE_DELAY_MS`

## Read commands

- `me`
- `search --query <text> [--type Text,Image,Link,Attachment,Embed,Channel] [--scope my] [--channel-id <id>] [--ext pdf,jpg] [--sort created_at_desc] [--page <n>] [--per <n>]`
- `channel-get --channel <id-or-slug>`
- `channel-contents --channel <id-or-slug> [--page <n>] [--per <n>] [--sort position_asc]`

## Write commands

- `channel-create --title <title> [--visibility closed] [--description <text>] [--group-id <id>]`
- `channel-update --channel <id-or-slug> [--title <title>] [--visibility closed] [--description <text>]`
- `block-create --channel <id-or-slug> --input block.json`
- `block-batch-create --channel <id-or-slug> --input blocks.json`
- `connection-create --channel <id-or-slug> --input connection.json`
- `upload-local-file --path <file> [--content-type image/jpeg]`
- `apply-manifest --input manifest.json [--dry-run]`

## Manifest execution

- Use `apply-manifest` for mixed curation workflows.
- `mode=create` creates the channel first, then applies items.
- `mode=extend` requires `target_channel`.
- `execution_mode=batch` is valid only for private channels and block-only imports.
- `execution_mode=auto` falls back to single-item writes whenever batch preconditions are not met.
- Upload items are presigned, PUT to S3, and then turned into normal block creations.
- Existing Are.na blocks and channels are added through `POST /v3/connections`.

## Output

- Every command prints JSON.
- Summaries should highlight created ids, skipped duplicates, and failures rather than pasting the whole payload unless the user asked for raw output.
