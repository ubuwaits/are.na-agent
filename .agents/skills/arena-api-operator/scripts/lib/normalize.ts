import { basename } from "node:path";

import type { ArenaConnectable, CuratedCandidate, CuratedUploadCandidate } from "./types.ts";

const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
  "spm",
  "si"
]);

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function normalizeText(value: string | null | undefined): string {
  return (value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  url.hash = "";
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();

  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = "";
  }

  const nextParams = new URLSearchParams();
  const entries = Array.from(url.searchParams.entries()).filter(([key]) => {
    return !key.toLowerCase().startsWith("utm_") && !TRACKING_PARAMS.has(key.toLowerCase());
  });

  entries.sort(([left], [right]) => left.localeCompare(right));
  for (const [key, entryValue] of entries) {
    nextParams.append(key, entryValue);
  }

  url.search = nextParams.toString() ? `?${nextParams.toString()}` : "";
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}

export async function fingerprintLocalFile(candidate: CuratedUploadCandidate): Promise<string> {
  const file = Bun.file(candidate.path);
  const exists = await file.exists();
  if (!exists) {
    throw new Error(`Local file does not exist: ${candidate.path}`);
  }

  const digest = await crypto.subtle.digest("SHA-1", await file.arrayBuffer());
  const bytes = toHex(new Uint8Array(digest));
  return `file:${basename(candidate.path)}:${file.size}:${bytes}`;
}

export function buildTitleProviderKey(title: string | null | undefined, provider: string | null | undefined): string | null {
  const normalizedTitle = normalizeText(title);
  const normalizedProvider = normalizeText(provider);
  if (!normalizedTitle && !normalizedProvider) {
    return null;
  }
  return `title-provider:${normalizedTitle}:${normalizedProvider}`;
}

export async function buildCandidateKeys(candidate: CuratedCandidate): Promise<string[]> {
  const keys = new Set<string>();

  if (candidate.source_identity) {
    keys.add(`source:${normalizeText(candidate.source_identity)}`);
  }

  const titleProviderKey = buildTitleProviderKey(candidate.title, candidate.source_provider);
  if (titleProviderKey) {
    keys.add(titleProviderKey);
  }

  if (candidate.original_source_url) {
    const normalizedOriginal = normalizeUrl(candidate.original_source_url);
    if (normalizedOriginal) {
      keys.add(`url:${normalizedOriginal}`);
    }
  }

  switch (candidate.kind) {
    case "text":
      keys.add(`text:${normalizeText(candidate.title)}:${normalizeText(candidate.value)}`);
      break;
    case "url": {
      const normalized = normalizeUrl(candidate.url);
      if (normalized) {
        keys.add(`url:${normalized}`);
      }
      break;
    }
    case "upload":
      keys.add(await fingerprintLocalFile(candidate));
      break;
    case "existing":
      keys.add(`connectable:${candidate.connectable_type}:${candidate.connectable_id}`);
      break;
  }

  return Array.from(keys);
}

export function buildConnectableKeys(connectable: ArenaConnectable): string[] {
  const keys = new Set<string>();

  if ("base_type" in connectable) {
    keys.add(`connectable:Block:${connectable.id}`);
    const titleProviderKey = buildTitleProviderKey(connectable.title, connectable.source?.provider?.name);
    if (titleProviderKey) {
      keys.add(titleProviderKey);
    }

    const sourceUrl = normalizeUrl(connectable.source?.url);
    if (sourceUrl) {
      keys.add(`url:${sourceUrl}`);
    }

    if (connectable.type === "Text") {
      keys.add(
        `text:${normalizeText(connectable.title)}:${normalizeText(connectable.content?.markdown || connectable.content?.plain)}`
      );
    }
  } else {
    keys.add(`connectable:Channel:${connectable.id}`);
    const titleProviderKey = buildTitleProviderKey(connectable.title, connectable.owner.type === "User" ? connectable.owner.name : connectable.owner.title);
    if (titleProviderKey) {
      keys.add(titleProviderKey);
    }
  }

  return Array.from(keys);
}
