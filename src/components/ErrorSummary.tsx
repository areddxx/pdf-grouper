import { useState } from 'react';
import { AlertTriangle, Copy, Check, X } from 'lucide-react';
import { useStore } from '@/state/store';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

const FEEDBACK_EMAIL = 'aredd@hawkemedia.com';

export function ErrorSummary() {
  const files = useStore((s) => s.files);
  const fatalError = useStore((s) => s.fatalError);
  const rejected = useStore((s) => s.rejected);
  const clearRejected = useStore((s) => s.clearRejected);
  const setFatalError = useStore((s) => s.setFatalError);
  const [copied, setCopied] = useState(false);

  const failed = files.filter((f) => f.status === 'failed');
  const noText = files.filter((f) => f.status === 'no-text');
  const partial = files.filter((f) => f.status === 'partial');

  const hasAnything = !!fatalError || rejected.length > 0 || failed.length > 0 || noText.length > 0 || partial.length > 0;
  if (!hasAnything) return null;

  function buildDiagnostic(): string {
    const lines: string[] = [];
    lines.push('PDF Grouper diagnostic');
    lines.push(`When: ${new Date().toISOString()}`);
    lines.push(`URL: ${location.href}`);
    lines.push(`Browser: ${navigator.userAgent}`);
    lines.push('');
    if (fatalError) {
      lines.push(`FATAL: ${fatalError}`);
      lines.push('');
    }
    if (rejected.length > 0) {
      lines.push(`Rejected (not recognized as PDF): ${rejected.length}`);
      for (const n of rejected) lines.push(`  - ${n}`);
      lines.push('');
    }
    if (failed.length > 0) {
      lines.push(`Failed: ${failed.length}`);
      for (const f of failed) {
        lines.push(`  - ${f.name} (${(f.size / 1024).toFixed(0)} KB) — ${f.note ?? 'no detail'}`);
      }
      lines.push('');
    }
    if (noText.length > 0) {
      lines.push(`No text (likely scanned/image-only): ${noText.length}`);
      for (const f of noText) lines.push(`  - ${f.name}`);
      lines.push('');
    }
    if (partial.length > 0) {
      lines.push(`Partial extraction: ${partial.length}`);
      for (const f of partial) lines.push(`  - ${f.name} — ${f.note ?? ''}`);
      lines.push('');
    }
    return lines.join('\n');
  }

  async function copyDiagnostic() {
    try {
      await navigator.clipboard.writeText(buildDiagnostic());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — fallback to console
      // eslint-disable-next-line no-console
      console.info(buildDiagnostic());
      alert('Clipboard blocked. Diagnostic logged to the browser console (View → Developer → JavaScript Console).');
    }
  }

  return (
    <div className={cn(
      'rounded-lg border p-4 space-y-3',
      fatalError ? 'border-destructive/40 bg-destructive/10' : 'border-warning/40 bg-warning/10'
    )}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={cn('h-5 w-5 mt-0.5 shrink-0', fatalError ? 'text-destructive' : 'text-warning')} />
        <div className="flex-1 min-w-0">
          {fatalError && (
            <div className="mb-2">
              <div className="font-semibold text-sm">Something went wrong</div>
              <div className="text-sm text-muted-foreground mt-0.5">{fatalError}</div>
              <button
                onClick={() => setFatalError(null)}
                className="text-xs text-muted-foreground hover:text-foreground mt-1 underline"
              >
                Dismiss
              </button>
            </div>
          )}
          {rejected.length > 0 && (
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="text-sm">
                <strong>{rejected.length}</strong> file{rejected.length === 1 ? ' was' : 's were'} ignored — not recognized as PDF:{' '}
                <span className="text-muted-foreground">{rejected.slice(0, 3).join(', ')}{rejected.length > 3 ? `, +${rejected.length - 3} more` : ''}</span>
              </div>
              <button onClick={clearRejected} className="text-muted-foreground hover:text-foreground shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {(failed.length > 0 || noText.length > 0 || partial.length > 0) && (
            <div className="space-y-1.5 text-sm">
              <div className="font-semibold">
                {failed.length + noText.length} of {files.length} PDF{files.length === 1 ? '' : 's'} couldn't be read fully
              </div>
              {failed.length > 0 && (
                <details className="ml-1">
                  <summary className="cursor-pointer hover:text-foreground">
                    <strong>{failed.length}</strong> failed to extract
                  </summary>
                  <ul className="mt-1 ml-4 space-y-0.5 text-muted-foreground text-xs">
                    {failed.map((f) => (
                      <li key={f.id} className="break-words">
                        <span className="font-mono">{f.name}</span> — {f.note}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {noText.length > 0 && (
                <details className="ml-1">
                  <summary className="cursor-pointer hover:text-foreground">
                    <strong>{noText.length}</strong> had no text (likely scanned image PDFs — need OCR)
                  </summary>
                  <ul className="mt-1 ml-4 space-y-0.5 text-muted-foreground text-xs">
                    {noText.map((f) => <li key={f.id} className="font-mono break-words">{f.name}</li>)}
                  </ul>
                </details>
              )}
              {partial.length > 0 && (
                <details className="ml-1">
                  <summary className="cursor-pointer hover:text-foreground">
                    <strong>{partial.length}</strong> had partial metadata (verify in the table)
                  </summary>
                  <ul className="mt-1 ml-4 space-y-0.5 text-muted-foreground text-xs">
                    {partial.map((f) => <li key={f.id} className="font-mono break-words">{f.name}</li>)}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
      {(fatalError || failed.length > 0 || noText.length > 0) && (
        <div className="flex items-center gap-2 pt-2 border-t border-current/10">
          <Button onClick={copyDiagnostic} variant="outline" size="sm">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy diagnostic'}
          </Button>
          <a
            href={`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('PDF Grouper issue')}&body=${encodeURIComponent('Paste diagnostic info here:\n\n')}`}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Email feedback
          </a>
          <span className="text-xs text-muted-foreground ml-auto">Diagnostic includes filenames + error messages, no file contents.</span>
        </div>
      )}
    </div>
  );
}
