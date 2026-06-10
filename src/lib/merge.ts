import { PDFDocument } from 'pdf-lib';
import type { Group } from './grouping';
import { buildFilename } from './filename';

/** Merge one group's non-skipped files in canonical doc-type order. */
export async function mergeGroup(group: Group): Promise<{ name: string; bytes: Uint8Array } | null> {
  const files = group.files.filter((f) => !f.skip && f.status !== 'failed');
  if (files.length === 0) return null;

  const merged = await PDFDocument.create();

  for (const f of files) {
    const bytes = await f.file.arrayBuffer();
    let src: PDFDocument;
    try {
      src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    } catch {
      // skip a corrupt source rather than fail the whole group
      continue;
    }
    const pages = await merged.copyPages(src, src.getPageIndices());
    for (const p of pages) merged.addPage(p);
  }

  const name = buildFilename({
    address: group.displayAddress,
    docTypes: files.map((f) => f.meta.docType),
    builder: group.resolvedBuilder,
    closingDate: group.resolvedDate,
  });

  const bytes = await merged.save();
  return { name, bytes };
}
