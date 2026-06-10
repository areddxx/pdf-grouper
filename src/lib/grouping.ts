import type { PdfFile } from '@/types';
import { docTypeSortKey } from './canonical';
import { groupKeyFor } from './extract';
import { streetOnly } from './normalize';

export interface Group {
  key: string;             // normalized + lowercased street
  displayAddress: string;  // street-only, properly cased
  files: PdfFile[];        // ordered for output (canonical by doc type)
  builders: string[];      // distinct
  dates: string[];         // distinct ISO
  /** majority builder (ties → first appearance) */
  resolvedBuilder: string;
  /** majority date (ties → latest) */
  resolvedDate: string;
  /** true if multiple distinct builders or dates among non-skipped files */
  conflict: boolean;
}

function modeWithLatestTiebreak(values: string[]): string {
  if (values.length === 0) return '';
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  if (counts.size === 0) return '';
  let best = '';
  let bestCount = 0;
  for (const [v, n] of counts) {
    if (n > bestCount || (n === bestCount && v > best)) {
      best = v;
      bestCount = n;
    }
  }
  return best;
}

function modeWithFirstTiebreak(values: string[]): string {
  if (values.length === 0) return '';
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const v of values) {
    if (!v) continue;
    if (!counts.has(v)) order.push(v);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  if (order.length === 0) return '';
  let best = order[0];
  let bestCount = counts.get(best) ?? 0;
  for (const v of order) {
    const n = counts.get(v) ?? 0;
    if (n > bestCount) {
      best = v;
      bestCount = n;
    }
  }
  return best;
}

export function groupFiles(files: PdfFile[]): { groups: Group[]; unmatched: PdfFile[] } {
  const byKey = new Map<string, PdfFile[]>();
  const unmatched: PdfFile[] = [];

  for (const f of files) {
    if (!f.groupKey) {
      unmatched.push(f);
      continue;
    }
    const list = byKey.get(f.groupKey) ?? [];
    list.push(f);
    byKey.set(f.groupKey, list);
  }

  const groups: Group[] = [];
  for (const [key, groupFiles] of byKey) {
    const active = groupFiles.filter((f) => !f.skip);

    const builders = Array.from(new Set(active.map((f) => f.meta.builder).filter(Boolean)));
    const dates = Array.from(new Set(active.map((f) => f.meta.closingDate).filter(Boolean)));

    const sorted = [...groupFiles].sort((a, b) => docTypeSortKey(a.meta.docType, b.meta.docType));

    // Display address: pick the first non-empty extracted address from the group, normalized to street only
    const display = streetOnly(active[0]?.meta.address ?? groupFiles[0].meta.address ?? '');

    groups.push({
      key,
      displayAddress: display || key,
      files: sorted,
      builders,
      dates,
      resolvedBuilder: modeWithFirstTiebreak(active.map((f) => f.meta.builder)),
      resolvedDate: modeWithLatestTiebreak(active.map((f) => f.meta.closingDate)),
      conflict: builders.length > 1 || dates.length > 1,
    });
  }

  // Sort groups by display address for stable UI
  groups.sort((a, b) => a.displayAddress.localeCompare(b.displayAddress));

  return { groups, unmatched };
}

/**
 * Re-derive the group key when the user edits a file's address inline.
 * Pass through if address is empty (file goes to unmatched).
 */
export function deriveGroupKey(address: string): string {
  return groupKeyFor(address);
}
