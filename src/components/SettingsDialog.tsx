import { useState } from 'react';
import { Settings, Plus, X } from 'lucide-react';
import { useStore } from '@/state/store';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { DEFAULT_BUILDERS } from '@/lib/canonical';

export function SettingsDialog() {
  const builders = useStore((s) => s.settings.builders);
  const setBuilders = useStore((s) => s.setBuilders);
  const [draft, setDraft] = useState('');

  function add() {
    const v = draft.trim();
    if (!v || builders.includes(v)) return;
    setBuilders([...builders, v]);
    setDraft('');
  }

  function remove(b: string) {
    setBuilders(builders.filter((x) => x !== b));
  }

  function reset() {
    setBuilders([...DEFAULT_BUILDERS]);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4" />
          Builders
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Builder list</DialogTitle>
          <DialogDescription>
            Names matched against document text to detect the builder. Stored locally in your browser.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add builder name"
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <Button onClick={add} size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-72 overflow-auto space-y-1 rounded border p-2">
          {builders.map((b) => (
            <div key={b} className="flex items-center justify-between rounded px-2 py-1 hover:bg-accent">
              <span className="text-sm">{b}</span>
              <button onClick={() => remove(b)} className="text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {builders.length === 0 && <div className="px-2 py-4 text-sm text-muted-foreground">No builders configured.</div>}
        </div>
        <div className="flex justify-between">
          <Button variant="ghost" size="sm" onClick={reset}>Reset to defaults</Button>
          <span className="text-xs text-muted-foreground self-center">{builders.length} entries</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
