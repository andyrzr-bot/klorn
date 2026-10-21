/**
 * Attachment text extraction, off the event loop.
 *
 * The extractor (email-attachment-text.ts) parses sender-controlled bytes — PDF,
 * DOCX, XLSX, PPTX, HWP — during Gmail sync, and the API serves every user and
 * runs every scheduler on one event loop. In one week three separate inputs
 * were found that stalled it for seconds to minutes (#1414, #1466, #1468); each
 * was fixed by making a scan linear. This bounds the next one instead of
 * waiting for it: extraction runs in a worker thread with a time limit and a
 * heap limit, so a stall, a crash or a runaway allocation costs that one
 * attachment's text — it reads as metadata, like any other unreadable file —
 * and never the server.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { captureError } from "../sentry.js";
import type { AttachmentExtractJob } from "./attachment-extract-worker.js";
import { type ExtractedAttachmentContent, metadataText } from "./email-attachment-text.js";

/** Room for a legitimate 8 MB file on a small shared-CPU instance; a stall is cut off here. */
const EXTRACT_TIMEOUT_MS = 10_000;
/** Inputs are at most 8 MB and archives stop at 8 MB inflated, so this is generous. */
const WORKER_HEAP_MB = 128;
/** One at a time: a burst of attachments must not become a burst of threads on one small instance. */
const MAX_CONCURRENT_EXTRACTIONS = 1;

const TIMEOUT_REASON = "본문 추출 시간 초과";
const FAILED_REASON = "본문 추출 실패";

export interface IsolatedExtractOptions {
  timeoutMs?: number;
  /** Test seam: run this worker script instead of the extractor. */
  workerUrl?: URL;
}

let active = 0;
const waiting: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  while (active >= MAX_CONCURRENT_EXTRACTIONS) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  active++;
}

function releaseSlot(): void {
  active--;
  waiting.shift()?.();
}

/** The compiled worker in production; from source, a bootstrap that loads it through tsx. */
function extractorWorker(): { url: URL; entry?: string } {
  const compiled = new URL("./attachment-extract-worker.js", import.meta.url);
  if (existsSync(fileURLToPath(compiled))) return { url: compiled };
  return {
    url: new URL("./attachment-extract-worker-dev.mjs", import.meta.url),
    entry: new URL("./attachment-extract-worker.ts", import.meta.url).href,
  };
}

function isExtracted(value: unknown): value is ExtractedAttachmentContent {
  if (typeof value !== "object" || value === null) return false;
  const { text, status } = value as { text?: unknown; status?: unknown };
  return (
    (typeof text === "string" || text === null) &&
    (status === "readable" || status === "metadata" || status === "unsupported")
  );
}

export async function extractAttachmentContentIsolated(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  options: IsolatedExtractOptions = {},
): Promise<ExtractedAttachmentContent> {
  await acquireSlot();
  try {
    return await runInWorker({ bytes: new Uint8Array(buffer), filename, mimeType }, options);
  } finally {
    releaseSlot();
  }
}

function runInWorker(
  job: AttachmentExtractJob,
  options: IsolatedExtractOptions,
): Promise<ExtractedAttachmentContent> {
  const timeoutMs = options.timeoutMs ?? EXTRACT_TIMEOUT_MS;
  const target = options.workerUrl ? { url: options.workerUrl } : extractorWorker();
  const degraded = (reason: string): ExtractedAttachmentContent => ({
    text: metadataText(job.filename, job.mimeType, job.bytes.byteLength, reason),
    status: "metadata",
  });
  // Never the filename: it is the sender's text.
  const report = (what: string, err: unknown) => {
    console.warn(`[ATTACHMENT] ${what} (${job.mimeType || "no type"}, ${job.bytes.byteLength} bytes)`, err);
    captureError(err, {
      tags: { scope: "attachment-extract.worker" },
      extra: { mimeType: job.mimeType, bytes: job.bytes.byteLength },
    });
  };

  return new Promise((resolve) => {
    let settled = false;
    const worker = new Worker(target.url, {
      workerData: { entry: target.entry, job },
      resourceLimits: { maxOldGenerationSizeMb: WORKER_HEAP_MB },
    });
    const finish = (result: ExtractedAttachmentContent) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      resolve(result);
    };
    const timer = setTimeout(() => {
      report(`extraction stopped after ${timeoutMs} ms`, new Error("attachment extraction timed out"));
      finish(degraded(TIMEOUT_REASON));
    }, timeoutMs);
    worker.once("message", (message: unknown) => {
      if (isExtracted(message)) return finish(message);
      report("extraction worker sent an unexpected result", new Error("unexpected worker message"));
      finish(degraded(FAILED_REASON));
    });
    worker.once("error", (err) => {
      report("extraction worker failed", err);
      finish(degraded(FAILED_REASON));
    });
    worker.once("exit", (code) => {
      if (settled) return;
      report("extraction worker exited without a result", new Error(`worker exit ${code}`));
      finish(degraded(FAILED_REASON));
    });
  });
}
