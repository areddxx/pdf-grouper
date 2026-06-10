import JSZip from 'jszip';
import { mergeGroup } from './merge';
import type { Group } from './grouping';

export interface CombineProgress {
  current: number;
  total: number;
  groupAddress: string;
}

/**
 * Sequentially merges each group and zips the results. Holds at most ONE
 * merged PDF in memory at a time before adding to the zip.
 */
export async function combineGroupsToZip(
  groups: Group[],
  onProgress?: (p: CombineProgress) => void
): Promise<Blob> {
  const zip = new JSZip();
  let i = 0;
  for (const g of groups) {
    i++;
    onProgress?.({ current: i, total: groups.length, groupAddress: g.displayAddress });
    const result = await mergeGroup(g);
    if (!result) continue;
    zip.file(result.name, result.bytes);
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
