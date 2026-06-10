/**
 * PURE extraction logic. No pdfjs imports — operates on already-extracted text.
 * Reusable from the Web Worker AND for re-extracting when the user pastes text manually.
 */
import { DOC_TYPE_PATTERNS, SUFFIX_REGEX_GROUP } from './canonical';
import { normalizeAddress, streetOnly } from './normalize';

const ADDRESS_RE = new RegExp(
  // number + 1-5 words + suffix; allow optional period after abbreviated suffix
  String.raw`\b(\d{1,6}\s+(?:[A-Za-z0-9'.-]+\s+){1,5}(?:${SUFFIX_REGEX_GROUP})\b\.?)`,
  'gi'
);

/** Context phrases preceding an address that strongly suggest it IS the property. */
const PROPERTY_LABELS = [
  'property address',
  'subject property',
  'address of property',
  'property located at',
  'property is located',
  'real property',
  'subject premises',
  'premises',
  'legal description',
  'property:',
  're:',
  'situated at',
  'situated in',
  'property',
];

/** Context phrases that mean an address is the OFFICE/BROKER/TITLE — never the property. */
const NEGATIVE_LABELS = [
  'broker',
  'brokerage',
  'office',
  'title company',
  'title agency',
  'title insurance company',
  'title insurer',
  'lender',
  'escrow agent',
  'escrow company',
  'settlement agent',
  'closing agent',
  'return to',
  'mailing address',
  'company address',
  'attn:',
  'attention:',
  'prepared by',
  'from:',
  'remit to',
  'pay to',
  'underwriter',
  'agent for',
];

const ADDRESS_CONTEXT_WINDOW = 80;

const DATE_PATTERNS: RegExp[] = [
  /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/g,
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})\b/gi,
];

const CLOSING_CONTEXT_RE = /closing\s+date|date\s+of\s+closing|closing/i;

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

export interface ExtractFields {
  address: string;
  builder: string;
  docType: string;
  closingDate: string;
}

export interface ExtractInput {
  /** title region = first 3 non-empty lines of page 1 ONLY */
  titleRegion: string;
  /** accumulated text from pages 1..N */
  bodyText: string;
  /** filename, used as doc-type fallback */
  filename: string;
  /** builders to match against */
  builders: string[];
}

/** Detect doc type from page-1 title region; fall back to filename. */
export function detectDocType(titleRegion: string, filename: string): string {
  for (const { type, re } of DOC_TYPE_PATTERNS) {
    if (re.test(titleRegion)) return type;
  }
  // filename fallback — strip extension first
  const stem = filename.replace(/\.[^.]+$/, '');
  for (const { type, re } of DOC_TYPE_PATTERNS) {
    if (re.test(stem)) return type;
  }
  return '';
}

interface AddressCandidate {
  raw: string;
  normLower: string;
  index: number;
  labelScore: number;
}

/**
 * Detect the property street address from a block of text.
 *
 * Strategy:
 *   1. Collect ALL address-shaped matches.
 *   2. Score each by the labeled context in the ~80 chars BEFORE it:
 *        +10 if a "property/subject/premises" label appears
 *        -10 if a "broker/office/title/lender/escrow" label appears
 *   3. Add a frequency bonus (capped at +5): an address that appears many
 *      times in the doc is almost always the subject property, not the
 *      letterhead office.
 *   4. Pick the highest score; ties broken by earliest-in-document.
 */
export function detectAddress(bodyText: string): string {
  const lower = bodyText.toLowerCase();
  const candidates: AddressCandidate[] = [];

  ADDRESS_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ADDRESS_RE.exec(bodyText)) !== null) {
    const raw = m[1].replace(/\.$/, '');
    const before = lower.slice(Math.max(0, m.index - ADDRESS_CONTEXT_WINDOW), m.index);

    let labelScore = 0;
    if (PROPERTY_LABELS.some((l) => before.includes(l))) labelScore += 10;
    if (NEGATIVE_LABELS.some((l) => before.includes(l))) labelScore -= 10;

    candidates.push({
      raw,
      normLower: normalizeAddress(raw).toLowerCase(),
      index: m.index,
      labelScore,
    });
  }

  if (candidates.length === 0) return '';

  // Frequency bonus per normalized address
  const freq = new Map<string, number>();
  for (const c of candidates) freq.set(c.normLower, (freq.get(c.normLower) ?? 0) + 1);

  const scored = candidates.map((c) => ({
    c,
    score: c.labelScore + Math.min(5, (freq.get(c.normLower) ?? 1) - 1),
  }));

  scored.sort((a, b) => b.score - a.score || a.c.index - b.c.index);
  return normalizeAddress(scored[0].c.raw);
}

/** Match against a known builder list (longest-name-wins to avoid "Lennar" beating "Lennar Homes"-like substrings). */
export function detectBuilder(bodyText: string, builders: string[]): string {
  const lower = bodyText.toLowerCase();
  const sorted = [...builders].sort((a, b) => b.length - a.length);
  for (const b of sorted) {
    if (lower.includes(b.toLowerCase())) return b;
  }
  return '';
}

interface DateHit { iso: string; nearClosing: boolean }

function parseNumericDate(mm: string, dd: string, yyyy: string): string | null {
  const m = parseInt(mm, 10);
  const d = parseInt(dd, 10);
  const y = parseInt(yyyy, 10);
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
}

function isNearClosing(text: string, index: number): boolean {
  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + 60);
  return CLOSING_CONTEXT_RE.test(text.slice(start, end));
}

/**
 * Find all dates, mark whether each is near a "closing" keyword.
 * If any closing-context date exists, return the latest of those.
 * Otherwise return the most-common date (ties → latest).
 */
export function detectClosingDate(bodyText: string): string {
  const hits: DateHit[] = [];

  // numeric form
  DATE_PATTERNS[0].lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DATE_PATTERNS[0].exec(bodyText)) !== null) {
    const iso = parseNumericDate(m[1], m[2], m[3]);
    if (iso) hits.push({ iso, nearClosing: isNearClosing(bodyText, m.index) });
  }

  // month-name form
  DATE_PATTERNS[1].lastIndex = 0;
  while ((m = DATE_PATTERNS[1].exec(bodyText)) !== null) {
    const month = MONTHS[m[1].toLowerCase()];
    const iso = parseNumericDate(String(month), m[2], m[3]);
    if (iso) hits.push({ iso, nearClosing: isNearClosing(bodyText, m.index) });
  }

  if (hits.length === 0) return '';

  const closingHits = hits.filter((h) => h.nearClosing);
  if (closingHits.length > 0) {
    closingHits.sort((a, b) => b.iso.localeCompare(a.iso));
    return closingHits[0].iso;
  }

  // mode (with latest tiebreak)
  const counts = new Map<string, number>();
  for (const h of hits) counts.set(h.iso, (counts.get(h.iso) ?? 0) + 1);
  let best = hits[0].iso;
  let bestCount = 0;
  for (const [iso, n] of counts) {
    if (n > bestCount || (n === bestCount && iso > best)) {
      best = iso;
      bestCount = n;
    }
  }
  return best;
}

/** Run all detectors. Returns empty strings for anything not found. */
export function extractFields(input: ExtractInput): ExtractFields {
  return {
    docType: detectDocType(input.titleRegion, input.filename),
    address: detectAddress(input.bodyText),
    builder: detectBuilder(input.bodyText, input.builders),
    closingDate: detectClosingDate(input.bodyText),
  };
}

/** All four required fields populated? Used by the worker to early-exit. */
export function isComplete(f: ExtractFields): boolean {
  return !!(f.address && f.builder && f.docType && f.closingDate);
}

/** Group key from an extracted address. */
export function groupKeyFor(address: string): string {
  return streetOnly(address).toLowerCase();
}

/** First N non-empty lines of a block of text — used to define the title region. */
export function firstNonEmptyLines(text: string, n: number): string {
  const lines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.trim();
    if (!t) continue;
    lines.push(t);
    if (lines.length >= n) break;
  }
  return lines.join('\n');
}
