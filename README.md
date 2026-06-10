# PDF Grouper

Combine real-estate transaction PDFs by property address — entirely in your browser.

Drop a folder (or multi-select files), the app extracts each PDF's address / builder / doc type / closing date, groups them, lets you fix anything mis-detected, then merges each group into a single PDF with the canonical filename. Everything runs client-side — PDFs never leave your machine.

## Filename format

```
{Address}- {Doc Type 1} & {Doc Type 2} & ...- {Builder}- {MM.YYYY}.pdf
```

Example: `124 Skyline Road- Sellers Statement & Purchase Agreement & Contract- Dream Finder Homes- 04.2025.pdf`

Doc types are sorted in canonical order: Sellers Statement, Purchase Agreement, Contract, Inspection Report, Loan Documents, Title Insurance, then any others alphabetical.

## Stack

- Vite + React + TypeScript
- Tailwind CSS + shadcn-style UI primitives
- `pdfjs-dist@4.7` for text extraction (Web Worker, page-streaming with early-exit at first complete metadata, hard cap at page 5)
- `pdf-lib` for merging
- `JSZip` for download packaging
- `react-dropzone` for upload UX
- `zustand` for state

## Setup

```bash
nvm use 24       # or any Node ≥ 20.18
corepack enable pnpm
pnpm install
pnpm dev
```

Open the URL Vite prints. Drop PDFs onto the dropzone (or use **Select folder**).

## Generate sample PDFs

A small node script creates synthetic test fixtures covering the tricky cases (abbreviated suffixes, all-caps, a 150-page filler PDF, an image-only PDF, an address-less doc):

```bash
pnpm samples
```

PDFs land in `./samples/` (gitignored — regenerate any time).

## Scripts

| Command         | Purpose                                |
| --------------- | -------------------------------------- |
| `pnpm dev`      | Vite dev server                        |
| `pnpm build`    | TypeScript check + production build    |
| `pnpm preview`  | Serve the built bundle                 |
| `pnpm lint`     | `tsc --noEmit` (typecheck only)        |
| `pnpm samples`  | Regenerate `./samples/*.pdf` fixtures  |

## Performance notes

Real-world transaction PDFs are often 100–300 pages, but the metadata we need (address, builder, doc type, closing date) is on the first 1–3 pages. The worker:

1. Opens the PDF (parses catalog only — cheap).
2. Extracts page 1's text, derives the **doc type from the first 3 non-empty lines** (title region) only.
3. Accumulates text page-by-page across pages 1–5, re-running address/builder/date detection.
4. Early-exits the moment all four fields are populated.
5. Calls `page.cleanup()` after each page to release memory.
6. Hard cap at page 5: anything still missing is flagged "partial extraction — verify manually" in the UI.

Concurrency is 3 in-worker. The progress bar updates per file. If a single page takes longer than 5 seconds, the UI falls back to a page-level message so it's clear nothing is frozen.

Scanned/image-only PDFs return no text and are flagged **"no text — needs OCR"** rather than silently producing empty metadata. The app does not attempt OCR.

## Deploy

### Cloudflare Pages

```bash
pnpm build
# Drag-and-drop the `dist/` folder into the Cloudflare Pages dashboard,
# or via Wrangler:
npx wrangler pages deploy dist --project-name=pdf-grouper
```

Build settings if connecting a Git repo:
- Build command: `pnpm build`
- Build output directory: `dist`
- Node version: 20+ (set `NODE_VERSION=20` in env vars if needed)

### Vercel

```bash
pnpm build
npx vercel deploy --prod
```

Or import the repo on vercel.com and accept the auto-detected Vite settings.

Both targets serve the app as a fully static SPA — no server runtime, no environment variables, no backend.

## Privacy

This app does no network I/O after the initial bundle load. Files you drop are read into memory in your browser, processed by a Web Worker, merged with `pdf-lib`, zipped with `JSZip`, and downloaded via an object URL. Nothing is uploaded.

## License

MIT.
