'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

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
      className="relative w-[52px] h-[26px] rounded-full border transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17834b]"
      style={{
        background: isDark ? '#17834b' : '#e7f4ea',
        borderColor: isDark ? '#126b3d' : '#c9e5d1',
      }}
    >
      {/* Track icons */}
      <span
        className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[11px] transition-opacity duration-200"
        style={{ opacity: isDark ? 0 : 1 }}
        aria-hidden
      >
        Light
      </span>
      <span
        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] transition-opacity duration-200"
        style={{ opacity: isDark ? 1 : 0 }}
        aria-hidden
      >
        Dark
      </span>
      {/* Thumb */}
      <span
        className="absolute top-0.5 w-[20px] h-[20px] rounded-full bg-white transition-[left] duration-300"
        style={{ left: isDark ? 'calc(100% - 22px)' : '3px' }}
      />
    </button>
  );
}
