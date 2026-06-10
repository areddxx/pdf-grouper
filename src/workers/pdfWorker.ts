/// <reference lib="webworker" />
/**
 * PDF extraction worker.
 *
 * Strategy:
 *   - Receive a list of files with stable IDs from the main thread.
 *   - For each file: lazy-load PDF, extract page 1, derive doc type from title region.
 *     Then accumulate text page-by-page (max 5), re-running address/builder/date detectors.
 *     Early-exit when all 4 fields are filled. Cleanup pages after reading.
 *   - Concurrency=3 in-worker via a tiny pool.
 *   - Post a 'page-slow' event if a single page takes >5s to extract.
 */

import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import {
  extractFields,
  isComplete,
  firstNonEmptyLines,
  groupKeyFor,
  type ExtractFields,
} from '@/lib/extract';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const MAX_PAGES = 5;
const SLOW_PAGE_MS = 5000;

export interface WorkerInputFile {
  id: string;
  name: string;
  size: number;
  file: File;
}

export type WorkerMessage =
  | { type: 'start'; files: WorkerInputFile[]; builders: string[] }
  | { type: 'cancel' };

export type WorkerEvent =
  | { type: 'file-start'; id: string; name: string; index: number; total: number }
  | { type: 'page-slow'; id: string; page: number; name: string }
  | {
      type: 'file-done';
      id: string;
      status: 'done' | 'partial' | 'no-text' | 'failed';
      meta: ExtractFields;
      groupKey: string;
      pagesScanned: number;
      pageCount: number;
      note?: string;
    }
  | { type: 'all-done' };

let cancelled = false;

self.addEventListener('message', async (e: MessageEvent<WorkerMessage>) => {
  if (e.data.type === 'cancel') {
    cancelled = true;
    return;
  }
  if (e.data.type !== 'start') return;

  cancelled = false;
  const { files, builders } = e.data;
  const total = files.length;

  let next = 0;
  const CONCURRENCY = 3;

  async function worker() {
    while (!cancelled) {
      const i = next++;
      if (i >= files.length) return;
      const f = files[i];
      post({ type: 'file-start', id: f.id, name: f.name, index: i, total });
      try {
        const result = await extractFromFile(f, builders);
        post({ type: 'file-done', id: f.id, ...result });
      } catch (err) {
        post({
          type: 'file-done',
          id: f.id,
          status: 'failed',
          meta: { address: '', builder: '', docType: '', closingDate: '' },
          groupKey: '',
          pagesScanned: 0,
          pageCount: 0,
          note: `extraction failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  post({ type: 'all-done' });
});

function post(msg: WorkerEvent) {
  (self as DedicatedWorkerGlobalScope).postMessage(msg);
}

async function extractFromFile(
  f: WorkerInputFile,
  builders: string[]
): Promise<Omit<Extract<WorkerEvent, { type: 'file-done' }>, 'type' | 'id'>> {
  const buf = await f.file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buf),
    disableFontFace: true,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  const pagesToScan = Math.min(MAX_PAGES, pageCount);

  let titleRegion = '';
  let bodyText = '';
  let fields: ExtractFields = { address: '', builder: '', docType: '', closingDate: '' };
  let scanned = 0;

  try {
    for (let p = 1; p <= pagesToScan; p++) {
      if (cancelled) break;
      const pageText = await extractPageText(pdf, p, f.id, f.name);
      scanned = p;

      if (p === 1) {
        titleRegion = firstNonEmptyLines(pageText, 3);
      }
      bodyText += (bodyText ? '\n' : '') + pageText;

      fields = extractFields({
        titleRegion,
        bodyText,
        filename: f.name,
        builders,
      });
      if (isComplete(fields)) break;
    }
  } finally {
    await pdf.destroy().catch(() => {});
  }

  const groupKey = groupKeyFor(fields.address);

  // Status determination
  const totalText = bodyText.replace(/\s/g, '');
  if (!totalText) {
    return {
      status: 'no-text',
      meta: fields,
      groupKey,
      pagesScanned: scanned,
      pageCount,
      note: 'no text — needs OCR',
    };
  }

  if (isComplete(fields)) {
    return { status: 'done', meta: fields, groupKey, pagesScanned: scanned, pageCount };
  }

  return {
    status: 'partial',
    meta: fields,
    groupKey,
    pagesScanned: scanned,
    pageCount,
    note: 'partial extraction — verify manually',
  };
}

async function extractPageText(
  pdf: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>,
  pageNum: number,
  id: string,
  name: string
): Promise<string> {
  const slowTimer = setTimeout(() => {
    post({ type: 'page-slow', id, page: pageNum, name });
  }, SLOW_PAGE_MS);

  try {
    const page = await pdf.getPage(pageNum);
    try {
      const content = await page.getTextContent();
      // Reassemble text with line breaks where pdfjs emits a hasEOL marker.
      const out: string[] = [];
      for (const item of content.items) {
        const ti = item as TextItem;
        if (typeof ti.str !== 'string') continue;
        out.push(ti.str);
        if (ti.hasEOL) out.push('\n');
        else out.push(' ');
      }
      return out.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n');
    } finally {
      page.cleanup();
    }
  } finally {
    clearTimeout(slowTimer);
  }
}

export {}; // ensure this is a module
