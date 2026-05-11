'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const ThemeCtx = createContext<{ theme: Theme; toggle: () => void; set: (t: Theme) => void }>({
  theme: 'light',
  toggle: () => {},
  set: () => {},
});

export const useTheme = () => useContext(ThemeCtx);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const stored = (typeof window !== 'undefined' && localStorage.getItem('dva-theme')) as Theme | null;
    const initial: Theme = stored ?? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');
  }, []);

  function set(next: Theme) {
    setTheme(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dva-theme', next);
      document.documentElement.classList.toggle('dark', next === 'dark');
    }
  }

  return (
    <ThemeCtx.Provider value={{ theme, toggle: () => set(theme === 'dark' ? 'light' : 'dark'), set }}>
      {children}
    </ThemeCtx.Provider>
  );
}
