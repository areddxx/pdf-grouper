/**
 * Main-thread wrapper around the PDF extraction worker.
 * Spins up a single worker instance on demand and exposes an async iterator-style API.
 */
import type { WorkerEvent, WorkerInputFile } from './pdfWorker';

export interface ExtractionCallbacks {
  onFileStart?: (e: Extract<WorkerEvent, { type: 'file-start' }>) => void;
  onFileDone?: (e: Extract<WorkerEvent, { type: 'file-done' }>) => void;
  onPageSlow?: (e: Extract<WorkerEvent, { type: 'page-slow' }>) => void;
  /** Worker itself failed to load / crashed — every file should be marked failed. */
  onWorkerError?: (message: string) => void;
}

let activeWorker: Worker | null = null;

export function runExtraction(
  files: WorkerInputFile[],
  builders: string[],
  cb: ExtractionCallbacks
): { cancel: () => void; done: Promise<void> } {
  // Recreate the worker each run so a previous cancelled run can't leak handlers
  if (activeWorker) {
    activeWorker.terminate();
    activeWorker = null;
  }

  let worker: Worker;
  try {
    worker = new Worker(new URL('./pdfWorker.ts', import.meta.url), { type: 'module' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    cb.onWorkerError?.(`Failed to start PDF processor: ${message}`);
    return { cancel: () => {}, done: Promise.resolve() };
  }
  activeWorker = worker;

  const done = new Promise<void>((resolve) => {
    worker.onmessage = (e: MessageEvent<WorkerEvent>) => {
      const msg = e.data;
      switch (msg.type) {
        case 'file-start':
          cb.onFileStart?.(msg);
          break;
        case 'file-done':
          cb.onFileDone?.(msg);
          break;
        case 'page-slow':
          cb.onPageSlow?.(msg);
          break;
        case 'all-done':
          resolve();
          break;
      }
    };
    worker.onerror = (ev) => {
      const message = ev.message || 'Unknown worker error';
      cb.onWorkerError?.(`PDF processor crashed: ${message}`);
      resolve();
    };
    worker.onmessageerror = () => {
      cb.onWorkerError?.('PDF processor sent malformed data.');
      resolve();
    };
  });

  worker.postMessage({ type: 'start', files, builders });

  return {
    cancel: () => {
      worker.postMessage({ type: 'cancel' });
      worker.terminate();
      if (activeWorker === worker) activeWorker = null;
    },
    done,
  };
}
