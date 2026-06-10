import { docTypeSortKey } from './canonical';
import { streetOnly } from './normalize';

const ILLEGAL_FS_CHARS = /[\/\\:*?"<>|]/g;

export function sanitizeForFilename(s: string): string {
  return s.replace(ILLEGAL_FS_CHARS, '').replace(/\s+/g, ' ').trim();
}

function formatMonthYear(iso: string): string {
  // iso = YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m] = iso.split('-');
  return `${m}.${y}`;
}

export interface GroupForFilename {
  address: string;
  docTypes: string[];
  builder: string;
  closingDate: string; // ISO
}

export function buildFilename(g: GroupForFilename): string {
  const addr = streetOnly(g.address);
  const types = Array.from(new Set(g.docTypes.filter(Boolean))).sort(docTypeSortKey);
  const typeStr = types.join(' & ');
  const date = formatMonthYear(g.closingDate);

  // Build with the exact spec separator: `- ` (hyphen + space) between sections
  // Spec example: `124 Skyline Road- Sellers Statement & Purchase Agreement & Contract- Dream Finder Homes- 04.2025.pdf`
  const sections = [addr, typeStr, g.builder, date].map((s) => s.trim());

  // If a section is empty we still need to keep the structure recognizable.
  // Empty sections collapse: we emit them as empty between separators.
  return sanitizeForFilename(`${sections[0]}- ${sections[1]}- ${sections[2]}- ${sections[3]}`) + '.pdf';
}
