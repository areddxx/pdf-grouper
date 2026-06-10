import type { DocType } from '@/types';

export const CANONICAL_DOC_TYPES: DocType[] = [
  'Sellers Statement',
  'Purchase Agreement',
  'Contract',
  'Inspection Report',
  'Loan Documents',
  'Title Insurance',
];

/**
 * Doc type detection patterns. Order matters — specific first, broadest last.
 * These run ONLY against the first 3 non-empty lines of page 1.
 */
export const DOC_TYPE_PATTERNS: ReadonlyArray<{ type: DocType; re: RegExp }> = [
  { type: 'Sellers Statement', re: /\bseller'?s?\s+statement\b/i },
  { type: 'Purchase Agreement', re: /\bpurchase\s+agreement\b/i },
  { type: 'Inspection Report', re: /\binspection\s+report\b/i },
  { type: 'Loan Documents', re: /\bloan\s+documents?\b/i },
  { type: 'Title Insurance', re: /\btitle\s+insurance\b/i },
  { type: 'Contract', re: /\bcontract\b/i },
];

/** Map of abbreviation -> full street suffix. Keys are lowercase. */
export const STREET_SUFFIX_MAP: Record<string, string> = {
  rd: 'Road',
  road: 'Road',
  dr: 'Drive',
  drive: 'Drive',
  ct: 'Court',
  court: 'Court',
  blvd: 'Boulevard',
  boulevard: 'Boulevard',
  pkwy: 'Parkway',
  parkway: 'Parkway',
  ln: 'Lane',
  lane: 'Lane',
  cir: 'Circle',
  circle: 'Circle',
  trl: 'Trail',
  trail: 'Trail',
  ave: 'Avenue',
  avenue: 'Avenue',
  st: 'Street',
  street: 'Street',
  pl: 'Place',
  place: 'Place',
  ter: 'Terrace',
  terrace: 'Terrace',
  hwy: 'Highway',
  highway: 'Highway',
  way: 'Way',
};

/** Pipe-joined regex piece matching any suffix (abbrev or full), case-insensitive. */
export const SUFFIX_REGEX_GROUP = Object.keys(STREET_SUFFIX_MAP)
  .sort((a, b) => b.length - a.length) // longest first to win in alternation
  .join('|');

export const DEFAULT_BUILDERS: string[] = [
  'Dream Finder Homes',
  'Dream Finders Homes',
  'Lennar',
  'Toll Brothers',
  'Richmond American Homes',
  'Shea Homes',
  'KB Home',
  'Meritage Homes',
  'Taylor Morrison',
  'David Weekley Homes',
  'Pulte Homes',
  'D.R. Horton',
  'Ryan Homes',
  'NVR',
  'PulteGroup',
  'Century Communities',
  'M/I Homes',
  'Tri Pointe Homes',
  'Beazer Homes',
  'Mattamy Homes',
  'LGI Homes',
];

/** Comparator for canonical doc-type ordering within a group filename. */
export function docTypeSortKey(a: string, b: string): number {
  const ia = CANONICAL_DOC_TYPES.indexOf(a as DocType);
  const ib = CANONICAL_DOC_TYPES.indexOf(b as DocType);
  // both canonical: by their order
  if (ia >= 0 && ib >= 0) return ia - ib;
  // canonical beats non-canonical
  if (ia >= 0) return -1;
  if (ib >= 0) return 1;
  // both non-canonical: alphabetical
  return a.localeCompare(b);
}
