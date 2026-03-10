import { ArenaValidationError } from "./errors.ts";
import { buildCandidateKeys, buildConnectableKeys } from "./normalize.ts";
import type {
  ArenaChannel,
  ArenaConnectable,
  BlockInput,
  ChannelCurationManifest,
  CreateConnectionInput,
  CuratedCandidate,
  CuratedExistingCandidate,
  CuratedUploadCandidate,
  PreparedBlockOperation,
  PreparedConnectionOperation
} from "./types.ts";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOptionalString(value: unknown, field: string, issues: string[]): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || !value.trim()) {
    issues.push(`${field} must be a non-empty string when provided.`);
    return undefined;
  }
  return value;
}

function readIdentifier(value: unknown, field: string, issues: string[]): number | string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  issues.push(`${field} must be a numeric id or non-empty slug.`);
  return undefined;
}

function validateCandidate(candidate: unknown, index: number, issues: string[]): CuratedCandidate | null {
  if (!isObject(candidate)) {
    issues.push(`items[${index}] must be an object.`);
    return null;
  }

  const kind = readOptionalString(candidate.kind, `items[${index}].kind`, issues);
  if (!kind) {
    return null;
  }

  const shared = {
    title: readOptionalString(candidate.title, `items[${index}].title`, issues),
    description: readOptionalString(candidate.description, `items[${index}].description`, issues),
    original_source_url: readOptionalString(candidate.original_source_url, `items[${index}].original_source_url`, issues),
    original_source_title: readOptionalString(candidate.original_source_title, `items[${index}].original_source_title`, issues),
    alt_text: readOptionalString(candidate.alt_text, `items[${index}].alt_text`, issues),
    source_identity: readOptionalString(candidate.source_identity, `items[${index}].source_identity`, issues),
    source_provider: readOptionalString(candidate.source_provider, `items[${index}].source_provider`, issues)
  };

  switch (kind) {
    case "text": {
      const value = readOptionalString(candidate.value, `items[${index}].value`, issues);
      if (!value) {
        return null;
      }
      return { kind, value, ...shared };
    }
    case "url": {
      const url = readOptionalString(candidate.url, `items[${index}].url`, issues);
      if (!url) {
        return null;
      }
      return { kind, url, ...shared };
    }
    case "upload": {
      const path = readOptionalString(candidate.path, `items[${index}].path`, issues);
      const contentType = readOptionalString(candidate.content_type, `items[${index}].content_type`, issues);
      if (!path) {
        return null;
      }
      const output: CuratedUploadCandidate = { kind, path, ...shared };
      if (contentType) {
        output.content_type = contentType;
      }
      return output;
    }
    case "existing": {
      const connectableId = readIdentifier(candidate.connectable_id, `items[${index}].connectable_id`, issues);
      const connectableType = readOptionalString(candidate.connectable_type, `items[${index}].connectable_type`, issues);
      if (!connectableId || (connectableType !== "Block" && connectableType !== "Channel")) {
        issues.push(`items[${index}].connectable_type must be "Block" or "Channel".`);
        return null;
      }
      return { kind, connectable_id: connectableId, connectable_type: connectableType, ...shared };
    }
    default:
      issues.push(`items[${index}].kind must be one of text, url, upload, existing.`);
      return null;
  }
}

export function validateManifest(input: unknown): ChannelCurationManifest {
  const issues: string[] = [];

  if (!isObject(input)) {
    throw new ArenaValidationError("Manifest must be a JSON object.", ["Manifest root must be an object."]);
  }

  const mode = readOptionalString(input.mode, "mode", issues);
  const theme = readOptionalString(input.theme, "theme", issues);
  const executionMode = readOptionalString(input.execution_mode, "execution_mode", issues);
  const manifest: ChannelCurationManifest = {
    mode: mode === "extend" ? "extend" : "create",
    theme: theme || "",
    items: [],
    execution_mode: executionMode === "single" || executionMode === "batch" || executionMode === "auto" ? executionMode : "auto"
  };

  if (mode !== "create" && mode !== "extend") {
    issues.push(`mode must be "create" or "extend".`);
  }

  if (!theme) {
    issues.push("theme is required.");
  }

  if (Array.isArray(input.items)) {
    manifest.items = input.items
      .map((candidate, index) => validateCandidate(candidate, index, issues))
      .filter((candidate): candidate is CuratedCandidate => Boolean(candidate));
  } else {
    issues.push("items must be an array.");
  }

  if (manifest.items.length === 0) {
    issues.push("items must contain at least one candidate.");
  }

  if (input.source_context !== undefined) {
    if (!isObject(input.source_context)) {
      issues.push("source_context must be an object when provided.");
    } else {
      manifest.source_context = {};
      const webQueries = input.source_context.web_queries;
      const arenaQueries = input.source_context.arena_queries;
      const notes = input.source_context.notes;
      if (Array.isArray(webQueries) && webQueries.every((entry) => typeof entry === "string")) {
        manifest.source_context.web_queries = webQueries;
      }
      if (Array.isArray(arenaQueries) && arenaQueries.every((entry) => typeof entry === "string")) {
        manifest.source_context.arena_queries = arenaQueries;
      }
      if (Array.isArray(notes) && notes.every((entry) => typeof entry === "string")) {
        manifest.source_context.notes = notes;
      }
    }
  }

  if (input.channel !== undefined) {
    if (!isObject(input.channel)) {
      issues.push("channel must be an object when provided.");
    } else {
      const title = readOptionalString(input.channel.title, "channel.title", issues);
      const description = input.channel.description === null ? undefined : readOptionalString(input.channel.description, "channel.description", issues);
      const visibility = readOptionalString(input.channel.visibility, "channel.visibility", issues);
      const groupId = input.channel.group_id;
      manifest.channel = {
        title: title || theme || "",
        visibility: visibility === "public" || visibility === "private" || visibility === "closed" ? visibility : "closed"
      };
      if (description) {
        manifest.channel.description = description;
      }
      if (typeof groupId === "number" && Number.isFinite(groupId)) {
        manifest.channel.group_id = groupId;
      } else if (groupId !== undefined) {
        issues.push("channel.group_id must be a number when provided.");
      }
    }
  }

  if (input.target_channel !== undefined) {
    const targetChannel = readIdentifier(input.target_channel, "target_channel", issues);
    if (targetChannel !== undefined) {
      manifest.target_channel = targetChannel;
    }
  }

  if (manifest.mode === "create") {
    manifest.channel = {
      title: manifest.channel?.title || theme || "",
      visibility: manifest.channel?.visibility || "closed",
      description: manifest.channel?.description,
      group_id: manifest.channel?.group_id
    };
  }

  if (manifest.mode === "extend" && manifest.target_channel === undefined) {
    issues.push("target_channel is required when mode is extend.");
  }

  if (issues.length > 0) {
    throw new ArenaValidationError("Manifest validation failed.", issues);
  }

  return manifest;
}

export function assertCanAddToChannel(channel: ArenaChannel): void {
  if (!channel.can?.add_to) {
    throw new ArenaValidationError(`You do not have permission to add content to ${channel.title}.`, [
      `Channel ${channel.id} (${channel.slug}) is not addable by the authenticated user.`
    ]);
  }
}

export function candidateToBlockInput(candidate: Exclude<CuratedCandidate, CuratedExistingCandidate>): BlockInput {
  switch (candidate.kind) {
    case "text":
      return {
        value: candidate.value,
        title: candidate.title,
        description: candidate.description,
        original_source_url: candidate.original_source_url,
        original_source_title: candidate.original_source_title,
        alt_text: candidate.alt_text
      };
    case "url":
      return {
        value: candidate.url,
        title: candidate.title,
        description: candidate.description,
        original_source_url: candidate.original_source_url,
        original_source_title: candidate.original_source_title,
        alt_text: candidate.alt_text
      };
    case "upload":
      throw new ArenaValidationError("Upload candidates must be resolved before being converted to block input.", [
        `Upload candidate ${candidate.path} reached candidateToBlockInput before presign/upload.`
      ]);
  }
}

export async function collectExistingKeys(connectables: ArenaConnectable[]): Promise<Set<string>> {
  const keys = new Set<string>();
  for (const connectable of connectables) {
    for (const key of buildConnectableKeys(connectable)) {
      keys.add(key);
    }
  }
  return keys;
}

export async function dedupeCandidates(
  candidates: CuratedCandidate[],
  existingKeys?: Set<string>
): Promise<{
  unique: Array<{ index: number; candidate: CuratedCandidate }>;
  skipped: Array<{ index: number; candidate: CuratedCandidate; reason: string }>;
}> {
  const seen = new Set(existingKeys || []);
  const unique: Array<{ index: number; candidate: CuratedCandidate }> = [];
  const skipped: Array<{ index: number; candidate: CuratedCandidate; reason: string }> = [];

  for (const [index, candidate] of candidates.entries()) {
    const keys = await buildCandidateKeys(candidate);
    const duplicateKey = keys.find((key) => seen.has(key));
    if (duplicateKey) {
      skipped.push({ index, candidate, reason: `Duplicate candidate key: ${duplicateKey}` });
      continue;
    }

    unique.push({ index, candidate });
    for (const key of keys) {
      seen.add(key);
    }
  }

  return { unique, skipped };
}

export function buildExistingConnectionInput(
  candidate: CuratedExistingCandidate,
  targetChannel: number | string
): CreateConnectionInput {
  return {
    connectable_id: candidate.connectable_id,
    connectable_type: candidate.connectable_type,
    channel_ids: [targetChannel]
  };
}

export function toPreparedConnectionOperation(
  index: number,
  candidate: CuratedExistingCandidate,
  targetChannel: number | string
): PreparedConnectionOperation {
  return {
    type: "connect-existing",
    index,
    candidate,
    input: buildExistingConnectionInput(candidate, targetChannel)
  };
}

export function toPreparedBlockOperation(
  index: number,
  candidate: Exclude<CuratedCandidate, CuratedExistingCandidate>,
  input: BlockInput
): PreparedBlockOperation {
  return {
    type: "create-block",
    index,
    candidate,
    input
  };
}
