import { Progress } from './ui/progress';
import { useStore } from '@/state/store';

export function ProcessingProgress() {
  const { index, total, currentName, slowPage } = useStore((s) => s.progress);
  const pct = total === 0 ? 0 : Math.round((index / total) * 100);
  return (
    <div className="space-y-3 rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {slowPage
            ? `Extracting page ${slowPage} of ${currentName}…`
            : currentName
              ? `Extracting metadata from ${currentName}…`
              : 'Preparing…'}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {index} / {total}
        </span>
      </div>
      <Progress value={pct} />
    </div>
  );
}
