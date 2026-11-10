'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface NotificationItem {
  id: string;
  type: string;
  message: string;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
}

interface NotificationBellProps {
  slug?: string;
}

export default function NotificationBell({ slug }: NotificationBellProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const fetchNotifications = async (silent = false) => {
    // Skip polling if tab is backgrounded / hidden
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }

    // Abort previous in-flight fetch if still running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      if (!silent) setLoading(true);

      // Auto-abort if server or connection hangs over 10 seconds
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch('/api/tenant/notifications?limit=15', {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!isMountedRef.current) return;

      if (res.ok) {
        const data = await res.json();
        if (isMountedRef.current) {
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      } else if (res.status === 401 || res.status === 403) {
        // Silently reset state if user is unauthenticated or session expired
        if (isMountedRef.current) {
          setNotifications([]);
          setUnreadCount(0);
        }
      }
    } catch (err: any) {
      // Never treat aborted requests as errors
      if (err?.name === 'AbortError' || !isMountedRef.current) {
        return;
      }
      // Use console.warn instead of console.error to avoid triggering Next.js dev error overlays
      // during temporary dev server recompilations, network blips, or tab suspensions
      console.warn('[NotificationBell] Unable to sync notifications:', err?.message || err);
    } finally {
      if (isMountedRef.current && !silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchNotifications(false);

    // Poll every 30 seconds only when tab is visible
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchNotifications(true);
      }
    }, 30000);

    // Sync immediately when tab regains focus/visibility
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const resolveLink = (rawLink?: string | null): string | null => {
    if (!rawLink) return null;
    if (rawLink.startsWith('http://') || rawLink.startsWith('https://')) return rawLink;
    if (!slug) return rawLink;
    if (rawLink.startsWith(`/${slug}/`) || rawLink === `/${slug}`) return rawLink;
    if (rawLink.startsWith('/')) return `/${slug}${rawLink}`;
    return `/${slug}/${rawLink}`;
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const res = await fetch('/api/tenant/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read_one', notificationId }),
      });
      if (res.ok && isMountedRef.current) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err: any) {
      console.warn('[NotificationBell] Failed to mark notification as read:', err?.message || err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const res = await fetch('/api/tenant/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read_all' }),
      });
      if (res.ok && isMountedRef.current) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch (err: any) {
      console.warn('[NotificationBell] Failed to mark all as read:', err?.message || err);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-600 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors focus:outline-none"
        title="Notifications"
      >
        {/* Bell Icon */}
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full shadow-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden text-slate-800 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-xs bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline focus:outline-none"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {loading && notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">No notifications yet.</div>
            ) : (
              notifications.map((n) => {
                const isUnread = !n.readAt;
                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (isUnread) markAsRead(n.id);
                    }}
                    className={`p-3.5 transition-colors cursor-pointer text-xs ${
                      isUnread ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between space-x-2">
                      <div className="flex-1">
                        <p
                          className={`leading-snug ${
                            isUnread ? 'font-semibold text-slate-900' : 'text-slate-600'
                          }`}
                        >
                          {n.message}
                        </p>
                        <span className="mt-1 block text-[10px] text-slate-400">
                          {new Date(n.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1" />
                      )}
                    </div>

                    {n.link && (
                      <Link
                        href={resolveLink(n.link) || '#'}
                        onClick={() => setIsOpen(false)}
                        className="inline-block mt-1.5 text-[11px] font-semibold text-blue-600 hover:underline"
                      >
                        View details →
                      </Link>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
