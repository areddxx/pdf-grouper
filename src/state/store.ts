import { create } from 'zustand';
import type { PdfFile, ExtractionStatus } from '@/types';
import { nanoid } from '@/lib/utils';
import { deriveGroupKey } from '@/lib/grouping';
import { DEFAULT_BUILDERS } from '@/lib/canonical';

export type Phase = 'idle' | 'extracting' | 'review' | 'combining';

interface ProgressState {
  index: number;
  total: number;
  currentName: string;
  slowPage?: number;
}

interface SettingsState {
  builders: string[];
  theme: 'light' | 'dark';
}

const LS_BUILDERS = 'pdf-grouper:builders';
const LS_THEME = 'pdf-grouper:theme';

function loadSettings(): SettingsState {
  const buildersRaw = localStorage.getItem(LS_BUILDERS);
  const themeRaw = localStorage.getItem(LS_THEME) as 'light' | 'dark' | null;
  return {
    builders: buildersRaw ? JSON.parse(buildersRaw) : DEFAULT_BUILDERS,
    theme: themeRaw ?? 'dark',
  };
}

function saveBuilders(b: string[]) {
  localStorage.setItem(LS_BUILDERS, JSON.stringify(b));
}
function saveTheme(t: 'light' | 'dark') {
  localStorage.setItem(LS_THEME, t);
}

interface CombineProgress {
  current: number;
  total: number;
  groupAddress: string;
}

interface Store {
  phase: Phase;
  files: PdfFile[];
  progress: ProgressState;
  combineProgress: CombineProgress | null;
  settings: SettingsState;

  // file lifecycle
  addFiles: (raw: File[]) => PdfFile[];
  setPhase: (p: Phase) => void;
  startProgress: (total: number) => void;
  setProgress: (p: Partial<ProgressState>) => void;
  markFileStatus: (id: string, patch: Partial<PdfFile>) => void;
  reset: () => void;

  // edits
  editMeta: (id: string, patch: Partial<PdfFile['meta']>) => void;
  reassignGroup: (id: string, newKey: string) => void;
  toggleSkip: (id: string) => void;

  // settings
  setBuilders: (b: string[]) => void;
  toggleTheme: () => void;

  // combine
  setCombineProgress: (p: CombineProgress | null) => void;
}

export const useStore = create<Store>((set, get) => ({
  phase: 'idle',
  files: [],
  progress: { index: 0, total: 0, currentName: '' },
  combineProgress: null,
  settings: loadSettings(),

  addFiles: (raw) => {
    const onlyPdf = raw.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    const created: PdfFile[] = onlyPdf.map((file) => ({
      id: nanoid(),
      name: file.name,
      size: file.size,
      file,
      status: 'pending' as ExtractionStatus,
      meta: { address: '', builder: '', docType: '', closingDate: '' },
      groupKey: '',
      skip: false,
    }));
    set((s) => ({ files: [...s.files, ...created] }));
    return created;
  },

  setPhase: (phase) => set({ phase }),

  startProgress: (total) =>
    set({ progress: { index: 0, total, currentName: '' } }),

  setProgress: (p) =>
    set((s) => ({ progress: { ...s.progress, ...p } })),

  markFileStatus: (id, patch) =>
    set((s) => ({
      files: s.files.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    })),

  reset: () =>
    set({
      phase: 'idle',
      files: [],
      progress: { index: 0, total: 0, currentName: '' },
      combineProgress: null,
    }),

  editMeta: (id, patch) =>
    set((s) => ({
      files: s.files.map((f) => {
        if (f.id !== id) return f;
        const meta = { ...f.meta, ...patch };
        const groupKey = 'address' in patch ? deriveGroupKey(meta.address) : f.groupKey;
        return { ...f, meta, groupKey };
      }),
    })),

  reassignGroup: (id, newKey) =>
    set((s) => {
      const target = s.files.find((f) => f.groupKey === newKey);
      const displayAddress = target?.meta.address ?? '';
      return {
        files: s.files.map((f) =>
          f.id === id
            ? { ...f, groupKey: newKey, meta: { ...f.meta, address: f.meta.address || displayAddress } }
            : f
        ),
      };
    }),

  toggleSkip: (id) =>
    set((s) => ({
      files: s.files.map((f) => (f.id === id ? { ...f, skip: !f.skip } : f)),
    })),

  setBuilders: (b) => {
    saveBuilders(b);
    set((s) => ({ settings: { ...s.settings, builders: b } }));
  },

  toggleTheme: () => {
    const cur = get().settings.theme;
    const next = cur === 'dark' ? 'light' : 'dark';
    saveTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    set((s) => ({ settings: { ...s.settings, theme: next } }));
  },

  setCombineProgress: (p) => set({ combineProgress: p }),
}));
