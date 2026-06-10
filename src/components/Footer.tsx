import { Lock } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-12 flex items-center justify-center gap-2 text-xs text-muted-foreground">
      <Lock className="h-3 w-3" />
      <span>All processing runs in your browser. No PDFs leave this device.</span>
    </footer>
  );
}
