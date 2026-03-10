# Channel Curation Manifest

Emit JSON that matches this shape before handing execution to `$arena-api-operator`:

```json
{
  "mode": "create",
  "theme": "Loose, human-readable theme summary",
  "channel": {
    "title": "Channel title",
    "description": "Markdown channel description",
    "visibility": "closed"
  },
  "items": [
    {
      "kind": "text",
      "title": "Optional title",
      "value": "Markdown text block"
    },
    {
      "kind": "url",
      "title": "Optional title override",
      "url": "https://example.com/article"
    },
    {
      "kind": "upload",
      "title": "Optional title override",
      "path": "/absolute/path/to/file.pdf"
    },
    {
      "kind": "existing",
      "connectable_type": "Block",
      "connectable_id": 12345
    }
  ],
  "source_context": {
    "web_queries": ["search phrase"],
    "arena_queries": ["search phrase"],
    "notes": ["why this mix works"]
  },
  "execution_mode": "auto"
}
```

## Required fields

- `mode`: `create` or `extend`
- `theme`: short summary of the motif
- `items`: ordered list of curated candidates
- `target_channel`: required when `mode` is `extend`

## Candidate kinds

- `text`: Create a Text block from markdown or plain text.
- `url`: Create a block from a public URL and let Are.na infer `Image`, `Link`, `Attachment`, or `Embed`.
- `upload`: Upload a local file, then create an `Image` or `Attachment` block from the uploaded S3 URL.
- `existing`: Connect an existing Are.na block or channel.

## Optional metadata

- `title`
- `description`
- `original_source_url`
- `original_source_title`
- `alt_text`
- `source_identity`
- `source_provider`

Use `source_identity` when the same item might appear under multiple URLs or search surfaces and you want stronger dedupe.
