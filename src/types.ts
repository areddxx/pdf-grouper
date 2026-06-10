export type DocType =
  | 'Sellers Statement'
  | 'Purchase Agreement'
  | 'Inspection Report'
  | 'Loan Documents'
  | 'Title Insurance'
  | 'Contract';

export interface ExtractedMeta {
  address: string;          // raw matched address (street portion preserved as-found, normalized)
  builder: string;
  docType: string;          // DocType or other string (filename fallback)
  closingDate: string;      // ISO YYYY-MM-DD or empty
}

export type ExtractionStatus =
  | 'pending'
  | 'extracting'
  | 'done'
  | 'partial'        // hit page cap before finding all fields
  | 'no-text'        // scanned / image-only
  | 'failed';        // exception during parse

export interface PdfFile {
  id: string;
  name: string;
  size: number;
  file: File;
  status: ExtractionStatus;
  /** detected metadata (mutable through inline edits) */
  meta: ExtractedMeta;
  /** group key (normalized address) — user-overridable */
  groupKey: string;
  /** user marked this file to skip from output */
  skip: boolean;
  /** non-fatal note shown in UI (e.g. "no text — needs OCR", "partial extraction") */
  note?: string;
  /** which page count was actually parsed before stopping */
  pagesScanned?: number;
  /** total page count of the source PDF */
  pageCount?: number;
}
