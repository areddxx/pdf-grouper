import { Moon, Sun } from 'lucide-react';
import { useStore } from '@/state/store';
import { Button } from './ui/button';

export function ThemeToggle() {
  const theme = useStore((s) => s.settings.theme);
  const toggle = useStore((s) => s.toggleTheme);
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
