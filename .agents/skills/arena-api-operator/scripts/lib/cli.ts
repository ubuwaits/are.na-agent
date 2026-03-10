import { readFile } from "node:fs/promises";

import { applyManifest } from "./apply-manifest.ts";
import { ArenaClient } from "./client.ts";
import { loadArenaEnv } from "./config.ts";
import { ArenaError, ArenaValidationError } from "./errors.ts";
import type {
  BatchCreateBlocksInput,
  BlockInput,
  CreateBlockInput,
  CreateChannelInput,
  CreateConnectionInput,
  SearchParams,
  UpdateChannelInput
} from "./types.ts";

type FlagValue = string | boolean | string[];

interface ParsedArgs {
  command?: string;
  flags: Record<string, FlagValue>;
  positionals: string[];
}

function appendFlag(flags: Record<string, FlagValue>, key: string, value: string | boolean): void {
  const current = flags[key];
  if (current === undefined) {
    flags[key] = value;
    return;
  }

  if (Array.isArray(current)) {
    current.push(String(value));
    return;
  }

  flags[key] = [String(current), String(value)];
}

export function parseArgv(argv: string[]): ParsedArgs {
  const flags: Record<string, FlagValue> = {};
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const withoutPrefix = token.slice(2);
    const [key, inlineValue] = withoutPrefix.split("=", 2);
    if (inlineValue !== undefined) {
      appendFlag(flags, key, inlineValue);
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      appendFlag(flags, key, true);
      continue;
    }

    appendFlag(flags, key, next);
    index += 1;
  }

  const command = positionals.shift();
  return { command, flags, positionals };
}

function getFlagString(flags: Record<string, FlagValue>, key: string): string | undefined {
  const value = flags[key];
  if (Array.isArray(value)) {
    return value[value.length - 1];
  }
  return typeof value === "string" ? value : undefined;
}

function getFlagBoolean(flags: Record<string, FlagValue>, key: string): boolean {
  return flags[key] === true;
}

function getFlagNumber(flags: Record<string, FlagValue>, key: string): number | undefined {
  const value = getFlagString(flags, key);
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getFlagStrings(flags: Record<string, FlagValue>, key: string): string[] | undefined {
  const value = flags[key];
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => entry.split(",")).map((entry) => entry.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value.split(",").map((entry) => entry.trim()).filter(Boolean);
  }

  return undefined;
}

async function readJsonInput(inputPath: string | undefined): Promise<unknown> {
  if (!inputPath || inputPath === "-") {
    const text = await new Response(Bun.stdin.stream()).text();
    return JSON.parse(text);
  }

  return JSON.parse(await readFile(inputPath, "utf8"));
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage(): string {
  return [
    "Usage: bun run .agents/skills/arena-api-operator/scripts/arena.ts <command> [flags]",
    "",
    "Commands:",
    "  me",
    "  search --query <text> [--type Text,Image,...] [--scope my] [--channel-id 123]",
    "  channel-get --channel <id-or-slug>",
    "  channel-contents --channel <id-or-slug> [--page 1] [--per 24] [--sort position_asc]",
    "  channel-create --title <title> [--visibility closed] [--description <text>] [--group-id 123]",
    "  channel-update --channel <id-or-slug> [--title <title>] [--visibility closed] [--description <text>]",
    "  block-create --channel <id-or-slug> --input block.json",
    "  block-batch-create --channel <id-or-slug> --input blocks.json",
    "  connection-create --channel <id-or-slug> --input connection.json",
    "  upload-local-file --path <file> [--content-type image/jpeg]",
    "  apply-manifest --input manifest.json [--dry-run]"
  ].join("\n");
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const parsed = parseArgv(argv);
  if (!parsed.command || parsed.command === "help" || getFlagBoolean(parsed.flags, "help")) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const env = loadArenaEnv();
  const client = new ArenaClient(env);

  switch (parsed.command) {
    case "me":
      printJson(await client.getCurrentUser());
      return;
    case "search": {
      const params: SearchParams = {
        query: getFlagString(parsed.flags, "query") || "*",
        type: getFlagStrings(parsed.flags, "type"),
        scope: getFlagString(parsed.flags, "scope"),
        user_id: getFlagNumber(parsed.flags, "user-id"),
        group_id: getFlagNumber(parsed.flags, "group-id"),
        channel_id: getFlagNumber(parsed.flags, "channel-id"),
        ext: getFlagStrings(parsed.flags, "ext"),
        sort: getFlagString(parsed.flags, "sort") as SearchParams["sort"],
        after: getFlagString(parsed.flags, "after"),
        seed: getFlagNumber(parsed.flags, "seed"),
        page: getFlagNumber(parsed.flags, "page"),
        per: getFlagNumber(parsed.flags, "per")
      };
      printJson(await client.search(params));
      return;
    }
    case "channel-get": {
      const channel = getFlagString(parsed.flags, "channel");
      if (!channel) {
        throw new ArenaValidationError("channel-get requires --channel.", ["Missing required --channel flag."]);
      }
      printJson(await client.getChannel(channel));
      return;
    }
    case "channel-contents": {
      const channel = getFlagString(parsed.flags, "channel");
      if (!channel) {
        throw new ArenaValidationError("channel-contents requires --channel.", ["Missing required --channel flag."]);
      }
      printJson(
        await client.getChannelContents(channel, {
          page: getFlagNumber(parsed.flags, "page"),
          per: getFlagNumber(parsed.flags, "per"),
          sort: getFlagString(parsed.flags, "sort"),
          user_id: getFlagNumber(parsed.flags, "user-id")
        })
      );
      return;
    }
    case "channel-create": {
      const input: CreateChannelInput = {
        title: getFlagString(parsed.flags, "title") || ""
      };
      const visibility = getFlagString(parsed.flags, "visibility");
      const description = getFlagString(parsed.flags, "description");
      const groupId = getFlagNumber(parsed.flags, "group-id");
      if (!input.title) {
        throw new ArenaValidationError("channel-create requires --title.", ["Missing required --title flag."]);
      }
      if (visibility) {
        input.visibility = visibility as CreateChannelInput["visibility"];
      }
      if (description) {
        input.description = description;
      }
      if (groupId !== undefined) {
        input.group_id = groupId;
      }
      printJson(await client.createChannel(input));
      return;
    }
    case "channel-update": {
      const channel = getFlagString(parsed.flags, "channel");
      if (!channel) {
        throw new ArenaValidationError("channel-update requires --channel.", ["Missing required --channel flag."]);
      }
      const input: UpdateChannelInput = {};
      const title = getFlagString(parsed.flags, "title");
      const visibility = getFlagString(parsed.flags, "visibility");
      const description = getFlagString(parsed.flags, "description");
      if (title) {
        input.title = title;
      }
      if (visibility) {
        input.visibility = visibility as UpdateChannelInput["visibility"];
      }
      if (description !== undefined) {
        input.description = description;
      }
      printJson(await client.updateChannel(channel, input));
      return;
    }
    case "block-create": {
      const channel = getFlagString(parsed.flags, "channel");
      const rawInput = await readJsonInput(getFlagString(parsed.flags, "input"));
      if (!channel) {
        throw new ArenaValidationError("block-create requires --channel.", ["Missing required --channel flag."]);
      }
      const input = rawInput as BlockInput;
      printJson(await client.createBlock({ ...input, channel_ids: [channel] } as CreateBlockInput));
      return;
    }
    case "block-batch-create": {
      const channel = getFlagString(parsed.flags, "channel");
      const rawInput = await readJsonInput(getFlagString(parsed.flags, "input"));
      if (!channel) {
        throw new ArenaValidationError("block-batch-create requires --channel.", ["Missing required --channel flag."]);
      }
      const blocks = Array.isArray(rawInput) ? (rawInput as BlockInput[]) : (rawInput as { blocks?: BlockInput[] }).blocks;
      if (!blocks || !Array.isArray(blocks)) {
        throw new ArenaValidationError("block-batch-create requires an array of block inputs.", [
          "Provide either a JSON array or an object with a blocks array."
        ]);
      }
      printJson(await client.batchCreateBlocks({ channel_ids: [channel], blocks } as BatchCreateBlocksInput));
      return;
    }
    case "connection-create": {
      const channel = getFlagString(parsed.flags, "channel");
      const rawInput = await readJsonInput(getFlagString(parsed.flags, "input"));
      if (!channel) {
        throw new ArenaValidationError("connection-create requires --channel.", ["Missing required --channel flag."]);
      }
      const input = rawInput as Omit<CreateConnectionInput, "channel_ids">;
      printJson(await client.createConnection({ ...input, channel_ids: [channel] }));
      return;
    }
    case "upload-local-file": {
      const path = getFlagString(parsed.flags, "path");
      if (!path) {
        throw new ArenaValidationError("upload-local-file requires --path.", ["Missing required --path flag."]);
      }
      printJson(await client.uploadLocalFile(path, getFlagString(parsed.flags, "content-type")));
      return;
    }
    case "apply-manifest": {
      const manifest = await readJsonInput(getFlagString(parsed.flags, "input"));
      printJson(await applyManifest(client, manifest, { dryRun: getFlagBoolean(parsed.flags, "dry-run") }));
      return;
    }
    default:
      throw new ArenaValidationError(`Unknown command: ${parsed.command}`, ["Run the CLI with --help to see supported commands."]);
  }
}

export async function runCli(argv = process.argv.slice(2)): Promise<number> {
  try {
    await main(argv);
    return 0;
  } catch (error) {
    if (error instanceof ArenaValidationError) {
      process.stderr.write(`${error.message}\n`);
      for (const issue of error.issues) {
        process.stderr.write(`- ${issue}\n`);
      }
      return 1;
    }

    if (error instanceof ArenaError) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }

    const message = error instanceof Error ? error.stack || error.message : String(error);
    process.stderr.write(`${message}\n`);
    return 1;
  }
}
