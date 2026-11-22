'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type AdminTheme = 'light' | 'dark';

const ThemeContext = createContext<{
  theme: AdminTheme;
  toggle: () => void;
}>({ theme: 'light', toggle: () => {} });

export function useAdminTheme() {
  return useContext(ThemeContext);
}

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<AdminTheme>('light');

  // On mount: read from localStorage, default to light
  useEffect(() => {
    const saved = localStorage.getItem('admin-theme') as AdminTheme | null;
    const resolved = saved === 'dark' ? 'dark' : 'light';
    setTheme(resolved);
    document.documentElement.setAttribute('data-admin-theme', resolved);
  }, []);

  const toggle = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('admin-theme', next);
      document.documentElement.setAttribute('data-admin-theme', next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ── Sun / Moon icon toggle button ─────────────────────────────────────────────
export function ThemeToggle() {
  const { theme, toggle } = useAdminTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border adm-divider adm-surface adm-surface-hover adm-text-secondary text-xs font-medium transition-colors cursor-pointer"
    >
      {isDark ? (
        <>
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span>Light</span>
        </>
      ) : (
        <>
          <Moon className="w-3.5 h-3.5" />
          <span>Dark</span>
        </>
      )}
    </button>
  );
}
