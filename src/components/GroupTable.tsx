import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, MoreVertical, FileX, FileCheck } from 'lucide-react';
import { useStore } from '@/state/store';
import { groupFiles, type Group } from '@/lib/grouping';
import type { PdfFile } from '@/types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { ConflictBadge } from './ConflictBadge';
import { EditableCell } from './EditableCell';
import { CANONICAL_DOC_TYPES } from '@/lib/canonical';
import { buildFilename } from '@/lib/filename';
import { cn } from '@/lib/utils';

export function GroupTable() {
  const files = useStore((s) => s.files);
  const editMeta = useStore((s) => s.editMeta);
  const reassign = useStore((s) => s.reassignGroup);
  const toggleSkip = useStore((s) => s.toggleSkip);

  const { groups, unmatched } = useMemo(() => groupFiles(files), [files]);

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <GroupRow
          key={g.key}
          group={g}
          allGroups={groups}
          onEdit={editMeta}
          onReassign={reassign}
          onToggleSkip={toggleSkip}
        />
      ))}
      {unmatched.length > 0 && (
        <UnmatchedSection
          files={unmatched}
          groups={groups}
          onEdit={editMeta}
          onReassign={reassign}
          onToggleSkip={toggleSkip}
        />
      )}
    </div>
  );
}

interface GroupRowProps {
  group: Group;
  allGroups: Group[];
  onEdit: (id: string, patch: Partial<PdfFile['meta']>) => void;
  onReassign: (id: string, key: string) => void;
  onToggleSkip: (id: string) => void;
}

function GroupRow({ group, allGroups, onEdit, onReassign, onToggleSkip }: GroupRowProps) {
  const [open, setOpen] = useState(true);
  const activeFiles = group.files.filter((f) => !f.skip);
  const previewName = useMemo(
    () =>
      buildFilename({
        address: group.displayAddress,
        docTypes: activeFiles.map((f) => f.meta.docType),
        builder: group.resolvedBuilder,
        closingDate: group.resolvedDate,
      }),
    [group, activeFiles]
  );

  return (
    <div className="rounded-lg border bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 hover:bg-accent/30"
      >
        <div className="flex items-center gap-3 min-w-0">
          {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          <div className="text-left min-w-0">
            <div className="font-semibold truncate">{group.displayAddress}</div>
            <div className="font-mono text-xs text-muted-foreground truncate">{previewName}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ConflictBadge count={activeFiles.length} conflict={group.conflict} />
        </div>
      </button>
      {open && (
        <div className="border-t">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium w-[28%]">File</th>
                <th className="px-3 py-2 text-left font-medium w-[18%]">Doc type</th>
                <th className="px-3 py-2 text-left font-medium w-[20%]">Address</th>
                <th className="px-3 py-2 text-left font-medium w-[16%]">Builder</th>
                <th className="px-3 py-2 text-left font-medium w-[12%]">Closing</th>
                <th className="px-3 py-2 w-[6%]"></th>
              </tr>
            </thead>
            <tbody>
              {group.files.map((f) => (
                <FileRow
                  key={f.id}
                  file={f}
                  allGroups={allGroups}
                  onEdit={onEdit}
                  onReassign={onReassign}
                  onToggleSkip={onToggleSkip}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface FileRowProps {
  file: PdfFile;
  allGroups: Group[];
  onEdit: (id: string, patch: Partial<PdfFile['meta']>) => void;
  onReassign: (id: string, key: string) => void;
  onToggleSkip: (id: string) => void;
}

function FileRow({ file, allGroups, onEdit, onReassign, onToggleSkip }: FileRowProps) {
  return (
    <tr className={cn('border-b last:border-0', file.skip && 'opacity-50 line-through')}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate" title={file.name}>{file.name}</span>
          <FileStatusBadge file={file} />
        </div>
      </td>
      <td className="px-2 py-2">
        <DocTypeSelect value={file.meta.docType} onChange={(v) => onEdit(file.id, { docType: v })} />
      </td>
      <td className="px-2 py-2">
        <EditableCell
          value={file.meta.address}
          placeholder="address"
          onChange={(v) => onEdit(file.id, { address: v })}
        />
      </td>
      <td className="px-2 py-2">
        <EditableCell
          value={file.meta.builder}
          placeholder="builder"
          onChange={(v) => onEdit(file.id, { builder: v })}
        />
      </td>
      <td className="px-2 py-2">
        <EditableCell
          value={file.meta.closingDate}
          placeholder="YYYY-MM-DD"
          onChange={(v) => onEdit(file.id, { closingDate: v })}
        />
      </td>
      <td className="px-2 py-2 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Reassign to group</DropdownMenuLabel>
            {allGroups
              .filter((g) => g.key !== file.groupKey)
              .map((g) => (
                <DropdownMenuItem key={g.key} onClick={() => onReassign(file.id, g.key)}>
                  {g.displayAddress}
                </DropdownMenuItem>
              ))}
            {allGroups.length <= 1 && (
              <DropdownMenuItem disabled>(no other groups)</DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onToggleSkip(file.id)}>
              {file.skip ? (
                <><FileCheck className="h-4 w-4 mr-2" />Include in output</>
              ) : (
                <><FileX className="h-4 w-4 mr-2" />Skip from output</>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function DocTypeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={CANONICAL_DOC_TYPES.includes(value as never) ? value : '__custom'}
      onChange={(e) => {
        if (e.target.value === '__custom') return;
        onChange(e.target.value);
      }}
      className="h-7 w-full rounded border bg-background px-1 text-sm"
    >
      {CANONICAL_DOC_TYPES.map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
      {!CANONICAL_DOC_TYPES.includes(value as never) && (
        <option value="__custom">{value || '(none)'}</option>
      )}
    </select>
  );
}

function FileStatusBadge({ file }: { file: PdfFile }) {
  if (file.status === 'no-text') return <Badge variant="destructive" className="text-[10px]">no text — needs OCR</Badge>;
  if (file.status === 'failed') return <Badge variant="destructive" className="text-[10px]">extraction failed</Badge>;
  if (file.status === 'partial') return <Badge variant="warning" className="text-[10px]">partial</Badge>;
  return null;
}

interface UnmatchedProps {
  files: PdfFile[];
  groups: Group[];
  onEdit: (id: string, patch: Partial<PdfFile['meta']>) => void;
  onReassign: (id: string, key: string) => void;
  onToggleSkip: (id: string) => void;
}

function UnmatchedSection({ files, groups, onEdit, onReassign, onToggleSkip }: UnmatchedProps) {
  return (
    <div className="rounded-lg border border-dashed bg-card">
      <div className="border-b px-4 py-3">
        <div className="font-semibold">Unmatched — no address detected</div>
        <div className="text-xs text-muted-foreground">
          Type the address inline to create a new group, or assign to an existing one via the menu.
        </div>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {files.map((f) => (
            <FileRow
              key={f.id}
              file={f}
              allGroups={groups}
              onEdit={onEdit}
              onReassign={onReassign}
              onToggleSkip={onToggleSkip}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
