import { ArenaHttpError, ArenaValidationError } from "./errors.ts";
import {
  assertCanAddToChannel,
  candidateToBlockInput,
  collectExistingKeys,
  dedupeCandidates,
  toPreparedBlockOperation,
  toPreparedConnectionOperation,
  validateManifest
} from "./manifest.ts";
import type {
  ApplyManifestOptions,
  ApplyManifestResult,
  ApplyResultItem,
  ArenaBlock,
  ArenaChannel,
  ArenaConnectable,
  BatchCreateBlocksInput,
  ChannelCurationManifest,
  CuratedCandidate,
  CuratedUploadCandidate,
  PreparedOperation
} from "./types.ts";
import { ArenaClient } from "./client.ts";

function asConnectables(payload: unknown): ArenaConnectable[] {
  if (!payload || typeof payload !== "object" || !("data" in payload)) {
    return [];
  }
  const data = (payload as { data?: unknown }).data;
  return Array.isArray(data) ? (data as ArenaConnectable[]) : [];
}

function toSkippedResult(index: number, candidate: CuratedCandidate, reason: string): ApplyResultItem {
  return {
    index,
    kind: candidate.kind,
    status: "skipped",
    title: candidate.title,
    reason
  };
}

function toFailedResult(index: number, candidate: CuratedCandidate, reason: string): ApplyResultItem {
  return {
    index,
    kind: candidate.kind,
    status: "failed",
    title: candidate.title,
    reason
  };
}

async function resolveUploadCandidate(client: ArenaClient, candidate: CuratedUploadCandidate): Promise<CuratedCandidate> {
  const upload = await client.uploadLocalFile(candidate.path, candidate.content_type);
  return {
    kind: "url",
    url: upload.storageUrl,
    title: candidate.title,
    description: candidate.description,
    original_source_url: candidate.original_source_url,
    original_source_title: candidate.original_source_title,
    alt_text: candidate.alt_text,
    source_identity: candidate.source_identity || upload.key,
    source_provider: candidate.source_provider
  };
}

async function prepareOperations(
  client: ArenaClient,
  targetChannel: ArenaChannel,
  manifest: ChannelCurationManifest,
  options: { skipExistingRead?: boolean } = {}
): Promise<{
  prepared: PreparedOperation[];
  skippedDuplicates: ApplyResultItem[];
}> {
  const existingKeys = options.skipExistingRead
    ? new Set<string>()
    : await collectExistingKeys(asConnectables(await client.getChannelContents(targetChannel.id, { per: 24, sort: "position_asc" })));
  const { unique, skipped } = await dedupeCandidates(manifest.items, existingKeys);

  const prepared: PreparedOperation[] = [];
  for (const entry of unique) {
    if (entry.candidate.kind === "existing") {
      prepared.push(toPreparedConnectionOperation(entry.index, entry.candidate, targetChannel.id));
      continue;
    }

    const blockSourceCandidate =
      entry.candidate.kind === "upload" ? await resolveUploadCandidate(client, entry.candidate) : entry.candidate;
    prepared.push(toPreparedBlockOperation(entry.index, entry.candidate, candidateToBlockInput(blockSourceCandidate)));
  }

  return {
    prepared,
    skippedDuplicates: skipped.map((entry) => toSkippedResult(entry.index, entry.candidate, entry.reason))
  };
}

function resolveExecutionMode(manifest: ChannelCurationManifest, targetChannel: ArenaChannel, prepared: PreparedOperation[]): "single" | "batch" {
  const executionMode = manifest.execution_mode || "auto";
  const batchAllowed = targetChannel.visibility === "private" && prepared.length > 1 && prepared.every((operation) => operation.type === "create-block");

  if (executionMode === "batch" && !batchAllowed) {
    throw new ArenaValidationError("Batch mode is only valid for private channels with block-only operations.", [
      `Channel visibility: ${targetChannel.visibility}`,
      `Operation types: ${prepared.map((operation) => operation.type).join(", ")}`
    ]);
  }

  if (executionMode === "auto") {
    return batchAllowed ? "batch" : "single";
  }

  return executionMode;
}

function batchInputFromOperations(channelId: number, operations: PreparedOperation[]): BatchCreateBlocksInput {
  return {
    channel_ids: [channelId],
    blocks: operations.map((operation) => {
      if (operation.type !== "create-block") {
        throw new ArenaValidationError("Connection operations cannot be sent through batch create.", [
          `Operation ${operation.index} had type ${operation.type}.`
        ]);
      }
      return operation.input;
    })
  };
}

function itemSummaryFromBlock(block: ArenaBlock, index: number, kind: CuratedCandidate["kind"]): ApplyResultItem {
  return {
    index,
    kind,
    id: block.id,
    status: "created",
    title: block.title || undefined,
    url: block.source?.url || block.attachment?.url || block.embed?.source_url || block.image?.src || undefined
  };
}

function shouldAbortSequence(error: unknown): boolean {
  return error instanceof ArenaHttpError && [401, 403, 429].includes(error.status);
}

export async function applyManifest(
  client: ArenaClient,
  rawManifest: unknown,
  options: ApplyManifestOptions = {}
): Promise<ApplyManifestResult> {
  const manifest = validateManifest(rawManifest);
  let createdChannel: ArenaChannel | undefined;
  let targetChannel: ArenaChannel | undefined;

  if (manifest.mode === "create") {
    if (options.dryRun) {
      targetChannel = {
        id: 0,
        type: "Channel",
        slug: "dry-run-channel",
        title: manifest.channel?.title || manifest.theme,
        visibility: manifest.channel?.visibility || "closed",
        owner: { id: 0, type: "User", name: "dry-run", slug: "dry-run" },
        can: { add_to: true, update: true, destroy: true, manage_collaborators: true }
      };
    } else {
      createdChannel = await client.createChannel({
        title: manifest.channel?.title || manifest.theme,
        description: manifest.channel?.description,
        visibility: manifest.channel?.visibility || "closed",
        group_id: manifest.channel?.group_id
      });
      targetChannel = createdChannel;
    }
  } else {
    targetChannel = await client.getChannel(manifest.target_channel as number | string);
    assertCanAddToChannel(targetChannel);
  }

  if (!targetChannel) {
    throw new ArenaValidationError("No target channel could be resolved.", ["Manifest resolution did not produce a channel."]);
  }

  const { prepared, skippedDuplicates } = await prepareOperations(client, targetChannel, manifest, {
    skipExistingRead: options.dryRun && manifest.mode === "create"
  });
  const resolvedMode = resolveExecutionMode(manifest, targetChannel, prepared);

  if (options.dryRun) {
    return {
      mode: manifest.mode,
      theme: manifest.theme,
      target_channel: targetChannel.id === 0 ? undefined : targetChannel,
      created_channel: createdChannel,
      execution_mode: resolvedMode,
      dry_run: true,
      attempted_items: manifest.items.length,
      deduped_items: prepared.length,
      skipped_duplicates: skippedDuplicates,
      applied_items: prepared.map((operation) => ({
        index: operation.index,
        kind: operation.candidate.kind,
        status: operation.type === "connect-existing" ? "connected" : "created",
        title: operation.candidate.title
      })),
      failures: []
    };
  }

  const appliedItems: ApplyResultItem[] = [];
  const failures: ApplyResultItem[] = [];

  if (resolvedMode === "batch") {
    const accepted = await client.batchCreateBlocks(batchInputFromOperations(targetChannel.id, prepared));
    const batchStatus = await client.pollBatch(accepted.batch_id);

    for (const success of batchStatus.successful || []) {
      const operation = prepared[success.index];
      if (!operation || operation.type !== "create-block") {
        continue;
      }
      appliedItems.push({
        index: operation.index,
        kind: operation.candidate.kind,
        id: success.block_id,
        status: "created",
        title: operation.candidate.title
      });
    }

    for (const failed of batchStatus.failed || []) {
      const operation = prepared[failed.index];
      if (!operation) {
        continue;
      }
      failures.push(toFailedResult(operation.index, operation.candidate, failed.error));
    }

    if (batchStatus.status === "failed" && batchStatus.error) {
      failures.push({
        index: -1,
        kind: "text",
        status: "failed",
        reason: batchStatus.error
      });
    }

    return {
      mode: manifest.mode,
      theme: manifest.theme,
      target_channel: targetChannel,
      created_channel: createdChannel,
      execution_mode: resolvedMode,
      dry_run: false,
      attempted_items: manifest.items.length,
      deduped_items: prepared.length,
      skipped_duplicates: skippedDuplicates,
      applied_items: appliedItems,
      failures,
      batch: batchStatus
    };
  }

  for (const operation of prepared) {
    try {
      if (operation.type === "create-block") {
        const block = await client.createBlock({
          ...operation.input,
          channel_ids: [targetChannel.id]
        });
        appliedItems.push(itemSummaryFromBlock(block, operation.index, operation.candidate.kind));
      } else {
        await client.createConnection(operation.input);
        appliedItems.push({
          index: operation.index,
          kind: operation.candidate.kind,
          connectable_type: operation.candidate.connectable_type,
          id: Number(operation.candidate.connectable_id),
          status: "connected",
          title: operation.candidate.title
        });
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      failures.push(toFailedResult(operation.index, operation.candidate, reason));
      if (shouldAbortSequence(error)) {
        break;
      }
    }

    await client.delayBetweenWrites();
  }

  return {
    mode: manifest.mode,
    theme: manifest.theme,
    target_channel: targetChannel,
    created_channel: createdChannel,
    execution_mode: resolvedMode,
    dry_run: false,
    attempted_items: manifest.items.length,
    deduped_items: prepared.length,
    skipped_duplicates: skippedDuplicates,
    applied_items: appliedItems,
    failures
  };
}
