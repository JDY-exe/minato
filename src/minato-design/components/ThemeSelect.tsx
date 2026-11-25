import { useId } from 'react';
import { useTheme } from '../theme/ThemeProvider';
import type { Theme } from '../theme/ThemeProvider';

export function ThemeSelect() {
  const { theme, setTheme } = useTheme();
  const id = useId();
  return <div className="mn-theme-select"><label htmlFor={id}>Appearance</label><select id={id} value={theme} onChange={event => setTheme(event.target.value as Theme)}>
    <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
  </select></div>;
}
