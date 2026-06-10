import { useEffect, useMemo } from 'react';
import { FileStack, RotateCcw } from 'lucide-react';
import { useStore } from '@/state/store';
import { Dropzone } from './components/Dropzone';
import { ProcessingProgress } from './components/ProcessingProgress';
import { GroupTable } from './components/GroupTable';
import { SettingsDialog } from './components/SettingsDialog';
import { ThemeToggle } from './components/ThemeToggle';
import { CombineButton } from './components/CombineButton';
import { Footer } from './components/Footer';
import { Button } from './components/ui/button';
import { runExtraction } from './workers/pdfWorkerClient';
import { groupFiles } from './lib/grouping';

export default function App() {
  const phase = useStore((s) => s.phase);
  const files = useStore((s) => s.files);
  const settings = useStore((s) => s.settings);

  const addFiles = useStore((s) => s.addFiles);
  const setPhase = useStore((s) => s.setPhase);
  const startProgress = useStore((s) => s.startProgress);
  const setProgress = useStore((s) => s.setProgress);
  const markFileStatus = useStore((s) => s.markFileStatus);
  const reset = useStore((s) => s.reset);

  // Apply persisted theme on mount
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);

  const groupCount = useMemo(() => groupFiles(files).groups.length, [files]);

  function onFiles(raw: File[]) {
    const added = addFiles(raw);
    if (added.length === 0) return;
    setPhase('extracting');
    startProgress(added.length);
    let finished = 0;
    runExtraction(
      added.map((f) => ({ id: f.id, name: f.name, size: f.size, file: f.file })),
      settings.builders,
      {
        onFileStart: (e) => {
          setProgress({ currentName: e.name, slowPage: undefined });
          markFileStatus(e.id, { status: 'extracting' });
        },
        onPageSlow: (e) => {
          setProgress({ slowPage: e.page });
        },
        onFileDone: (e) => {
          finished++;
          markFileStatus(e.id, {
            status: e.status,
            meta: e.meta,
            groupKey: e.groupKey,
            note: e.note,
            pagesScanned: e.pagesScanned,
            pageCount: e.pageCount,
          });
          setProgress({ index: finished, slowPage: undefined });
        },
      }
    ).done.then(() => setPhase('review'));
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <FileStack className="h-5 w-5 text-primary" />
            <span className="font-semibold">PDF Grouper</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Real-estate transaction PDFs, grouped by address
            </span>
          </div>
          <div className="flex items-center gap-2">
            {files.length > 0 && (
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw className="h-4 w-4" />
                Start over
              </Button>
            )}
            <SettingsDialog />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {phase === 'idle' && <Dropzone onFiles={onFiles} />}
        {phase === 'extracting' && (
          <div className="space-y-6">
            <ProcessingProgress />
          </div>
        )}
        {(phase === 'review' || phase === 'combining') && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Review {groupCount} group{groupCount === 1 ? '' : 's'}</h2>
                <p className="text-sm text-muted-foreground">
                  Fix anything mis-detected, then combine. {files.length} file{files.length === 1 ? '' : 's'} processed.
                </p>
              </div>
              <CombineButton />
            </div>
            <GroupTable />
          </div>
        )}
      </main>

      <div className="px-6 pb-6">
        <Footer />
      </div>
    </div>
  );
}
