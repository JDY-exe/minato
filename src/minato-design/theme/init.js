// Keep this storage key aligned with ThemeProvider. Run before React mounts.
try {
  const preference = localStorage.getItem('minato-theme');
  const dark = preference === 'dark' || (preference !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
} catch {
  // CSS retains the operating-system preference when storage is unavailable.
}
