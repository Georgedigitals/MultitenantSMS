'use client';

import { useEffect, useState } from 'react';

interface ImpersonationSession {
  logId: string;
  superAdminId: string;
  superAdminName: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  reason: string;
  startedAt: string;
}

interface ImpersonationBannerProps {
  currentTenantSlug?: string;
}

export function ImpersonationBanner({ currentTenantSlug }: ImpersonationBannerProps) {
  const [session, setSession] = useState<ImpersonationSession | null>(null);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) {
        const val = parts.pop()?.split(';').shift();
        return val ? decodeURIComponent(val) : null;
      }
      return null;
    };

    const cookieVal = getCookie('bms_impersonate_session');
    if (cookieVal) {
      try {
        const parsed: ImpersonationSession = JSON.parse(cookieVal);
        // Ensure the banner ONLY displays if the impersonation target matches the current tenant slug
        if (!currentTenantSlug || parsed.tenantSlug === currentTenantSlug) {
          setSession(parsed);
        } else {
          setSession(null);
        }
      } catch (e) {
        console.error('Failed to parse impersonation session cookie', e);
        setSession(null);
      }
    } else {
      setSession(null);
    }
  }, [currentTenantSlug]);

  if (!session) return null;

  const handleExit = async () => {
    setEnding(true);
    let redirectUrl = '';
    try {
      // Call server FIRST while cookies are still attached so the server can read logId and mark endedAt
      const res = await fetch('/api/admin/impersonate/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId: session.logId }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.redirectUrl) {
        redirectUrl = data.redirectUrl;
      }
    } catch (err) {
      console.error('Failed to end impersonation', err);
    } finally {
      // Clear client-accessible cookies AFTER the server has recorded endedAt
      document.cookie = 'bms_impersonate_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'bms_tenant_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';

      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
        const protocol = window.location.protocol;
        window.location.href = `${protocol}//${rootDomain}/admin/tenants`;
      }
    }
  };

  return (
    <div
      id="super-admin-impersonation-banner"
      className="print:hidden sticky top-0 z-[99999] bg-amber-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between font-medium text-sm border-b border-amber-700 select-none"
    >
      <div className="flex items-center gap-2">
        <span className="bg-amber-800 text-amber-100 text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider">
          Super Admin Impersonation Mode
        </span>
        <span>
          Viewing as <strong className="underline">{session.tenantName}</strong> ({session.tenantSlug}) — Reason: &ldquo;{session.reason}&rdquo;
        </span>
      </div>

      <button
        onClick={handleExit}
        disabled={ending}
        className="bg-amber-950 hover:bg-black text-amber-100 px-3 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
      >
        {ending ? 'Exiting...' : 'Exit Impersonation'}
      </button>
    </div>
  );
}
