import { AlertTriangle, Check } from 'lucide-react';
import { Badge } from './ui/badge';

interface Props {
  count: number;
  conflict: boolean;
}

export function ConflictBadge({ count, conflict }: Props) {
  if (conflict) {
    return (
      <Badge variant="warning" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        {count} docs · conflict
      </Badge>
    );
  }
  return (
    <Badge variant="success" className="gap-1">
      <Check className="h-3 w-3" />
      {count} doc{count === 1 ? '' : 's'}
    </Badge>
  );
}
