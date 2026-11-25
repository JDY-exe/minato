import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';
type ThemeContextValue = { theme: Theme; resolvedTheme: 'light' | 'dark'; setTheme: (theme: Theme) => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);
const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark' || value === 'system';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<Theme>(() => {
    try { const stored = localStorage.getItem('minato-theme'); return isTheme(stored) ? stored : 'system'; }
    catch { return 'system'; }
  });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(media.matches);
    media.addEventListener('change', onChange);
    onChange();
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'minato-theme' || event.key === null) updateTheme(isTheme(event.newValue) ? event.newValue : 'system');
    };
    window.addEventListener('storage', onStorage);
    return () => { media.removeEventListener('change', onChange); window.removeEventListener('storage', onStorage); };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolvedTheme === 'dark' ? '#10191d' : '#e0fbfc');
  }, [resolvedTheme]);

  const setTheme = (value: Theme) => {
    updateTheme(value);
    try { localStorage.setItem('minato-theme', value); } catch { /* In-memory themes still work. */ }
  };

  return <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside a Minato ThemeProvider.');
  return context;
}
