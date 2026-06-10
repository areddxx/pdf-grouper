import { useEffect, useMemo } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useStore } from '@/state/store';
import { Button } from './ui/button';
import { groupFiles } from '@/lib/grouping';
import { combineGroupsToZip, downloadBlob } from '@/lib/zip';

export function CombineButton() {
  const files = useStore((s) => s.files);
  const phase = useStore((s) => s.phase);
  const setPhase = useStore((s) => s.setPhase);
  const setCombineProgress = useStore((s) => s.setCombineProgress);
  const combineProgress = useStore((s) => s.combineProgress);

  const groups = useMemo(() => groupFiles(files).groups.filter((g) => g.files.some((f) => !f.skip)), [files]);
  const disabled = groups.length === 0 || phase === 'combining' || phase === 'extracting';

  async function run() {
    if (disabled) return;
    setPhase('combining');
    try {
      const blob = await combineGroupsToZip(groups, (p) => setCombineProgress(p));
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `pdf-grouper-${stamp}.zip`);
    } finally {
      setCombineProgress(null);
      setPhase('review');
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        run();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, disabled]);

  return (
    <div className="flex items-center gap-3">
      {combineProgress && (
        <span className="text-sm text-muted-foreground">
          Merging {combineProgress.current}/{combineProgress.total}: {combineProgress.groupAddress}
        </span>
      )}
      <Button onClick={run} disabled={disabled} size="lg">
        {phase === 'combining' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Combine {groups.length} group{groups.length === 1 ? '' : 's'}
        <kbd className="ml-2 rounded bg-primary-foreground/20 px-1.5 py-0.5 text-[10px]">⌘↵</kbd>
      </Button>
    </div>
  );
}
