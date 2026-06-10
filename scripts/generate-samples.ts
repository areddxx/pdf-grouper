/**
 * Generate synthetic test PDFs in ./samples for development.
 *
 * Run:  pnpm samples
 *
 * Produces a small portfolio of files covering:
 *   - two distinct addresses with multiple doc types each
 *   - abbreviated vs full street suffix (groups should merge)
 *   - all-caps suffix (should normalize)
 *   - a 150-page PDF with metadata only on page 1 (perf test)
 *   - an "image-only" PDF (no text — should flag as needs OCR)
 *   - a file with NO matching address (lands in unmatched bucket)
 */
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SAMPLES = join(here, '..', 'samples');

interface DocSpec {
  filename: string;
  title: string;            // shown on the first line — drives doc-type detection
  address?: string;
  builder?: string;
  closingDate?: string;     // e.g., "04/15/2025"
  extraPages?: number;      // pad with filler pages to test the 150-page case
  noText?: boolean;         // produce a text-less PDF
  extraBody?: string;       // extra body content
}

const SPECS: DocSpec[] = [
  {
    filename: 'skyline_sellers_statement.pdf',
    title: "Seller's Statement",
    address: '124 Skyline Road, Aurora, CO 80016',
    builder: 'Dream Finder Homes',
    closingDate: '04/15/2025',
  },
  {
    filename: 'skyline_purchase_agreement.pdf',
    title: 'Purchase Agreement',
    address: '124 Skyline Rd, Aurora, CO 80016',  // abbreviated — should group with the above
    builder: 'Dream Finder Homes',
    closingDate: '04/15/2025',
  },
  {
    filename: 'skyline_contract.pdf',
    title: 'Real Estate Contract',
    address: '124 SKYLINE RD',                    // all-caps + abbrev
    builder: 'Dream Finder Homes',
    closingDate: 'April 15, 2025',
  },
  {
    filename: 'highland_seller_statement.pdf',
    title: 'Sellers Statement',
    address: '552 Highland Meadow WAY, Castle Rock, CO',
    builder: 'Lennar',
    closingDate: '03/02/2025',
  },
  {
    filename: 'highland_purchase.pdf',
    title: 'Purchase Agreement',
    address: '552 Highland Meadow Way',
    builder: 'Lennar',
    closingDate: '3/2/2025',
  },
  {
    filename: 'highland_inspection.pdf',
    title: 'Property Inspection Report',
    address: '552 Highland Meadow Way',
    builder: 'Lennar',
    closingDate: '03/02/2025',
  },
  {
    filename: 'big_loan_documents.pdf',
    title: 'Loan Documents',
    address: '124 Skyline Road, Aurora, CO 80016',
    builder: 'Dream Finder Homes',
    closingDate: '04/15/2025',
    extraPages: 149, // → 150-page PDF, perf test
  },
  {
    filename: 'no_address_doc.pdf',
    title: 'Contract',
    builder: 'Lennar',
    closingDate: '05/05/2025',
    extraBody: 'This contract has no street address embedded for testing the unmatched bucket.',
  },
  {
    filename: 'scanned_image_doc.pdf',
    title: '',
    noText: true,
  },
];

async function writeOne(spec: DocSpec): Promise<void> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  if (spec.noText) {
    // Empty page — pdfjs.getTextContent will return zero items
    pdf.addPage([612, 792]);
  } else {
    const page = pdf.addPage([612, 792]);
    let y = 740;
    const draw = (text: string, opts: { size?: number; gap?: number } = {}) => {
      const size = opts.size ?? 11;
      page.drawText(text, { x: 54, y, size, font });
      y -= opts.gap ?? size + 4;
    };

    if (spec.title) draw(spec.title, { size: 20, gap: 30 });
    if (spec.address) draw(`Property: ${spec.address}`);
    if (spec.builder) draw(`Builder: ${spec.builder}`);
    if (spec.closingDate) draw(`Closing Date: ${spec.closingDate}`);
    draw('');
    draw('This document is a synthetic test fixture.');
    if (spec.extraBody) {
      for (const line of spec.extraBody.split('\n')) draw(line);
    }

    for (let i = 0; i < (spec.extraPages ?? 0); i++) {
      const filler = pdf.addPage([612, 792]);
      filler.drawText(`Filler page ${i + 2}`, { x: 54, y: 740, size: 12, font });
    }
  }

  const bytes = await pdf.save();
  const out = join(SAMPLES, spec.filename);
  await writeFile(out, bytes);
  const pages = pdf.getPageCount();
  console.log(`  ✓ ${spec.filename} (${pages} page${pages === 1 ? '' : 's'})`);
}

async function main() {
  await mkdir(SAMPLES, { recursive: true });
  console.log(`Generating ${SPECS.length} sample PDFs in ${SAMPLES}`);
  for (const spec of SPECS) await writeOne(spec);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
