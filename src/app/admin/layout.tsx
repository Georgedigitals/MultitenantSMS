import React from 'react';
import { headers } from 'next/headers';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { AdminSidebar } from '@/components/admin-sidebar';
import { AdminThemeProvider, ThemeToggle } from '@/components/admin-theme-provider';

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const reqHeaders = await headers();
  const adminPathname = reqHeaders.get('x-admin-pathname');

  if (adminPathname === '/admin/login' || adminPathname === '/login') {
    return (
      <AdminThemeProvider>
        <div className="adm-shell min-h-screen flex flex-col font-sans">
          {children}
        </div>
      </AdminThemeProvider>
    );
  }

  const auth = await getSuperAdminFromCookies();

  if (!auth) {
    return (
      <AdminThemeProvider>
        <div className="adm-shell min-h-screen flex flex-col font-sans">
          {children}
        </div>
      </AdminThemeProvider>
    );
  }

  return (
    <AdminThemeProvider>
      <div className="adm-shell min-h-screen flex flex-col md:flex-row font-sans selection:bg-[#d6f0df] selection:text-[#102d43]">
        {/* Sidebar */}
        <AdminSidebar
          adminName={auth.superAdmin.name}
          adminEmail={auth.superAdmin.email}
        />

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">

          {/* Top header */}
          <header
            className="adm-header hidden md:flex border-b sticky top-0 z-30 h-14 px-6 items-center justify-between"
            style={{ borderBottomColor: 'var(--adm-divider)' }}
          >
            {/* Status */}
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#17834b]" />
              </span>
              <span className="text-xs adm-text-secondary">
                Platform Status:{' '}
                <span className="text-[#17834b] font-semibold">Available</span>
              </span>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-3">
              {/* Dark / Light toggle */}
              <ThemeToggle />

              {/* Super Admin badge */}
              <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium adm-accent-subtle adm-text-accent adm-accent-border">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M8 1a7 7 0 100 14A7 7 0 008 1zM6.5 5.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM8 9a2.5 2.5 0 00-2.45 2h4.9A2.5 2.5 0 008 9z" clipRule="evenodd" />
                </svg>
                Super Admin Zone
              </span>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 p-5 sm:p-7 lg:p-9 max-w-screen-xl mx-auto w-full">
            {children}
          </main>

          <footer
            className="border-t py-4 px-6 text-center text-xs adm-text-muted"
            style={{ borderTopColor: 'var(--adm-divider)' }}
          >
            BMS · Platform administration
          </footer>
        </div>
      </div>
    </AdminThemeProvider>
  );
}
