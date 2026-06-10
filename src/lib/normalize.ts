import { STREET_SUFFIX_MAP } from './canonical';

function titleCaseWord(w: string): string {
  if (!w) return w;
  // Preserve dotted abbreviations like D.R. unchanged if all-caps with dots
  if (/^[A-Z](\.[A-Z])+\.?$/.test(w)) return w;
  return w[0].toUpperCase() + w.slice(1).toLowerCase();
}

/**
 * Normalize an extracted address:
 *   - title-case every word (don't preserve all-caps)
 *   - expand the trailing street suffix abbreviation to full form
 *
 * Examples:
 *   "552 Highland Meadow WAY" -> "552 Highland Meadow Way"
 *   "124 Skyline Rd"          -> "124 Skyline Road"
 */
export function normalizeAddress(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  const parts = trimmed.split(' ');
  const titled = parts.map(titleCaseWord);
  // Expand last token if it's a known suffix
  const last = titled[titled.length - 1];
  const key = last.toLowerCase().replace(/\.$/, '');
  if (STREET_SUFFIX_MAP[key]) {
    titled[titled.length - 1] = STREET_SUFFIX_MAP[key];
  }
  return titled.join(' ');
}

/**
 * Take only the street portion (everything before the first comma)
 * — used both as the filename prefix and the grouping key.
 */
export function streetOnly(address: string): string {
  if (!address) return '';
  const idx = address.indexOf(',');
  const street = idx >= 0 ? address.slice(0, idx) : address;
  return normalizeAddress(street);
}
