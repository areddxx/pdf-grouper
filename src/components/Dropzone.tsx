import { useDropzone } from 'react-dropzone';
import { useRef } from 'react';
import { FileUp, FolderUp } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface Props {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export function Dropzone({ onFiles, disabled }: Props) {
  const folderInputRef = useRef<HTMLInputElement>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
    disabled,
    onDrop: (accepted) => {
      if (accepted.length) onFiles(accepted);
    },
  });

  function handleFolderSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) =>
      f.name.toLowerCase().endsWith('.pdf')
    );
    if (files.length) onFiles(files);
    e.target.value = '';
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        'group relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-8 py-16 transition-colors cursor-pointer',
        isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/30',
        disabled && 'pointer-events-none opacity-50'
      )}
    >
      <input {...getInputProps()} />
      <div className="rounded-full bg-secondary p-4">
        <FileUp className="h-8 w-8 text-primary" />
      </div>
      <div className="text-center max-w-md">
        <p className="text-lg font-semibold">Drop transaction PDFs here</p>
        <p className="text-sm text-muted-foreground mt-1">
          Drag a folder or multi-select PDFs. They'll be grouped by property address.
        </p>
        <p className="text-xs text-muted-foreground mt-3">
          Example: <code className="rounded bg-muted px-1 py-0.5">closing-docs/124 Skyline/*.pdf</code>
        </p>
      </div>
      <div className="flex gap-2 mt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            folderInputRef.current?.click();
          }}
        >
          <FolderUp className="h-4 w-4" />
          Select folder
        </Button>
      </div>
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error -- non-standard but widely supported
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={handleFolderSelect}
      />
    </div>
  );
}
