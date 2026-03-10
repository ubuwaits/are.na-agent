import { basename, extname } from "node:path";

import { ArenaHttpError, ArenaValidationError } from "./errors.ts";
import type {
  ArenaBlock,
  ArenaChannel,
  ArenaConnection,
  ArenaEnv,
  ArenaUser,
  BatchAcceptedResponse,
  BatchCreateBlocksInput,
  BatchStatusResponse,
  CreateBlockInput,
  CreateChannelInput,
  CreateConnectionInput,
  PaginatedResponse,
  PresignFileRequest,
  PresignResponse,
  SearchParams,
  UpdateChannelInput,
  UploadResult
} from "./types.ts";

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".md": "text/markdown",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".webm": "video/webm",
  ".webp": "image/webp"
};

export interface ArenaClientDependencies {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

function buildQueryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue;
      }
      params.set(key, value.join(","));
      continue;
    }

    params.set(key, String(value));
  }

  const stringified = params.toString();
  return stringified ? `?${stringified}` : "";
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (response.status === 204) {
    return undefined;
  }
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  if (typeof payload === "object" && payload !== null) {
    const maybePayload = payload as { error?: string; details?: { message?: string } };
    if (maybePayload.details?.message) {
      return maybePayload.details.message;
    }
    if (maybePayload.error) {
      return maybePayload.error;
    }
  }

  return fallback;
}

export class ArenaClient {
  private readonly env: ArenaEnv;
  private readonly fetchImpl: typeof fetch;
  private readonly sleepImpl: (ms: number) => Promise<void>;

  constructor(env: ArenaEnv, dependencies: ArenaClientDependencies = {}) {
    this.env = env;
    this.fetchImpl = dependencies.fetch || fetch;
    this.sleepImpl = dependencies.sleep || ((ms) => Bun.sleep(ms));
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(`${this.env.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.env.accessToken}`,
        ...init.headers
      }
    });

    const payload = await parseResponseBody(response);
    if (!response.ok) {
      const retryAfter = response.headers.get("retry-after");
      throw new ArenaHttpError(
        getErrorMessage(payload, `Are.na request failed with status ${response.status}.`),
        response.status,
        payload,
        retryAfter ? Number.parseInt(retryAfter, 10) : null
      );
    }

    return payload as T;
  }

  getCurrentUser(): Promise<ArenaUser> {
    return this.request<ArenaUser>("/v3/me");
  }

  search(params: SearchParams): Promise<PaginatedResponse<unknown>> {
    return this.request<PaginatedResponse<unknown>>(`/v3/search${buildQueryString(params)}`);
  }

  getChannel(channel: number | string): Promise<ArenaChannel> {
    return this.request<ArenaChannel>(`/v3/channels/${channel}`);
  }

  getChannelContents(
    channel: number | string,
    params: { page?: number; per?: number; sort?: string; user_id?: number } = {}
  ): Promise<PaginatedResponse<unknown>> {
    return this.request<PaginatedResponse<unknown>>(`/v3/channels/${channel}/contents${buildQueryString(params)}`);
  }

  createChannel(input: CreateChannelInput): Promise<ArenaChannel> {
    return this.request<ArenaChannel>("/v3/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
  }

  updateChannel(channel: number | string, input: UpdateChannelInput): Promise<ArenaChannel> {
    return this.request<ArenaChannel>(`/v3/channels/${channel}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
  }

  createBlock(input: CreateBlockInput): Promise<ArenaBlock> {
    return this.request<ArenaBlock>("/v3/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
  }

  batchCreateBlocks(input: BatchCreateBlocksInput): Promise<BatchAcceptedResponse> {
    return this.request<BatchAcceptedResponse>("/v3/blocks/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
  }

  getBatchStatus(batchId: string): Promise<BatchStatusResponse> {
    return this.request<BatchStatusResponse>(`/v3/blocks/batch/${batchId}`);
  }

  async pollBatch(batchId: string): Promise<BatchStatusResponse> {
    const startedAt = Date.now();

    while (true) {
      const status = await this.getBatchStatus(batchId);
      if (status.status === "completed" || status.status === "failed") {
        return status;
      }

      if (Date.now() - startedAt > this.env.batchPollTimeoutMs) {
        throw new ArenaHttpError(`Timed out waiting for batch ${batchId} to finish.`, 408, status);
      }

      await this.sleepImpl(this.env.batchPollIntervalMs);
    }
  }

  createConnection(input: CreateConnectionInput): Promise<{ data: ArenaConnection[] }> {
    return this.request<{ data: ArenaConnection[] }>("/v3/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
  }

  presignUploads(files: PresignFileRequest[]): Promise<PresignResponse> {
    return this.request<PresignResponse>("/v3/uploads/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files })
    });
  }

  async uploadLocalFile(path: string, contentType?: string): Promise<UploadResult> {
    const file = Bun.file(path);
    const exists = await file.exists();
    if (!exists) {
      throw new ArenaValidationError(`File ${path} does not exist.`, [`The path ${path} is not readable.`]);
    }

    const resolvedContentType = contentType || file.type || CONTENT_TYPE_BY_EXTENSION[extname(path).toLowerCase()] || "application/octet-stream";
    const filename = basename(path);
    const presigned = await this.presignUploads([{ filename, content_type: resolvedContentType }]);
    const target = presigned.files[0];
    if (!target) {
      throw new ArenaValidationError(`No presigned upload target was returned for ${path}.`, [
        "The presign response did not include a file target."
      ]);
    }

    const uploadResponse = await this.fetchImpl(target.upload_url, {
      method: "PUT",
      headers: { "Content-Type": target.content_type },
      body: file
    });

    if (!uploadResponse.ok) {
      const payload = await parseResponseBody(uploadResponse);
      throw new ArenaHttpError(
        `Uploading ${path} to the presigned URL failed.`,
        uploadResponse.status,
        payload,
        uploadResponse.headers.get("retry-after") ? Number.parseInt(uploadResponse.headers.get("retry-after") as string, 10) : null
      );
    }

    return {
      path,
      filename,
      contentType: target.content_type,
      key: target.key,
      storageUrl: `https://s3.amazonaws.com/arena_images-temp/${target.key}`,
      bytes: file.size
    };
  }

  async delayBetweenWrites(): Promise<void> {
    if (this.env.writeDelayMs > 0) {
      await this.sleepImpl(this.env.writeDelayMs);
    }
  }
}
