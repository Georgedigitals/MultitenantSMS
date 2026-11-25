'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NotificationBell from './notification-bell';
import { CommandPalette, CommandItem } from './command-palette';
import { LanguageSwitcher, useLanguage } from '@/components/language-provider';

interface TenantSidebarProps {
  slug: string;
  role: string;
  isFormTeacher?: boolean;
  tenantName: string;
  logoUrl?: string | null;
  primaryColor?: string;
  accentColor?: string;
  userName: string;
  userEmail?: string | null;
  userAvatarUrl?: string | null;
  enabledFeatures?: Record<string, boolean>;
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  featureKey?: string;
}

interface NavGroup {
  groupName: string;
  items: NavItem[];
}

export default function TenantSidebar({
  slug,
  role,
  isFormTeacher = false,
  tenantName,
  logoUrl,
  primaryColor = '#141414',
  accentColor = '#1d5fbf',
  userName,
  userEmail,
  userAvatarUrl,
  enabledFeatures,
  children,
}: TenantSidebarProps) {
  const pathname = usePathname();
  const { t, tp } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Avatar & User Menu Dropdown State
  const [userAvatar, setUserAvatar] = useState<string | null>(userAvatarUrl || null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUploadMsg, setAvatarUploadMsg] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  // Change Password Modal State
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const userMenuRef = React.useRef<HTMLDivElement>(null);
  const avatarFileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userAvatarUrl !== undefined) {
      setUserAvatar(userAvatarUrl || null);
    }
  }, [userAvatarUrl]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close user dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [userMenuOpen]);

  // Global keydown listeners for Escape & Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserMenuOpen(false);
        setChangePasswordOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setAvatarUploadMsg({ text: 'Please select a valid image (PNG, JPG, WebP, GIF)', type: 'error' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarUploadMsg({ text: 'Image size exceeds 5MB limit', type: 'error' });
      return;
    }

    try {
      setIsUploadingAvatar(true);
      setAvatarUploadMsg(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'avatars');

      const uploadRes = await fetch('/api/tenant/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadData.error || 'Failed to upload photo');
      }

      // Persist avatar URL in database
      const patchRes = await fetch('/api/tenant/profile/avatar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: uploadData.url }),
      });

      const patchData = await patchRes.json();
      if (!patchRes.ok) {
        throw new Error(patchData.error || 'Failed to save avatar');
      }

      setUserAvatar(uploadData.url);
      setAvatarUploadMsg({ text: 'Profile photo updated!', type: 'success' });
      setTimeout(() => setAvatarUploadMsg(null), 3500);
    } catch (err: any) {
      setAvatarUploadMsg({ text: err.message || 'Upload failed', type: 'error' });
    } finally {
      setIsUploadingAvatar(false);
      if (avatarFileInputRef.current) {
        avatarFileInputRef.current.value = '';
      }
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    try {
      setChangingPassword(true);
      const res = await fetch('/api/tenant/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to change password');
      }

      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setChangePasswordOpen(false);
        setPasswordSuccess(null);
      }, 1500);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const isSchoolAdmin = role === 'school_admin';
  const isTeacher = role === 'teacher';
  const isParent = role === 'parent';
  const isStudent = role === 'student';
  const isStaffOrAdmin = isSchoolAdmin || isTeacher;

  // Formatted Role Label
  const roleLabelMap: Record<string, string> = {
    school_admin: 'School Admin',
    teacher: 'Staff / Teacher',
    parent: 'Parent / Guardian',
    student: 'Student',
  };
  const roleLabel = roleLabelMap[role] || role;

  // Generate School Initials for Fallback Badge
  const schoolInitials = tenantName
    .split(' ')
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'SCH';

  // Helper for 2-Letter User Avatar Monogram
  function getUserInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  const isPathRouted = pathname?.startsWith(`/${slug}`) ?? false;
  const resolveHref = (href: string) => {
    if (!href || href === '#' || href.startsWith('http')) return href;
    if (isPathRouted) {
      if (href === '/') return `/${slug}`;
      if (!href.startsWith(`/${slug}`)) return `/${slug}${href}`;
    }
    return href;
  };

  // Role-Specific Dropdown Navigation Menu
  const roleMenuItems = useMemo(() => {
    if (role === 'school_admin') {
      return [
        {
          title: 'My Profile & ID Card',
          subtitle: 'Passport photo, blood group & DOB',
          href: resolveHref('/dashboard/profile'),
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
        {
          title: 'School Settings',
          subtitle: 'Branding, sessions, grading & fees',
          href: resolveHref('/dashboard/settings'),
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        },
        {
          title: 'Change Password',
          subtitle: 'Update your security credentials',
          onClick: () => setChangePasswordOpen(true),
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          ),
        },
        {
          title: 'Public School Website',
          subtitle: 'Open public website in new tab',
          href: resolveHref('/'),
          target: '_blank' as const,
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          ),
        },
      ];
    }

    if (role === 'teacher') {
      return [
        {
          title: 'My Profile & ID Card',
          subtitle: 'Passport photo, blood group & DOB',
          href: resolveHref('/dashboard/profile'),
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
        {
          title: 'My Classes & Subjects',
          subtitle: 'Assigned classes and subjects',
          href: resolveHref('/dashboard/assignments'),
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          ),
        },
        {
          title: 'Enter Subject Scores',
          subtitle: 'Submit CA and exam marks',
          href: resolveHref('/dashboard/results/entry'),
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          ),
        },
        {
          title: 'Change Password',
          subtitle: 'Update your staff login password',
          onClick: () => setChangePasswordOpen(true),
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          ),
        },
        {
          title: 'Public School Website',
          subtitle: 'Visit public school website',
          href: resolveHref('/'),
          target: '_blank' as const,
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          ),
        },
      ];
    }

    if (role === 'parent') {
      return [
        {
          title: 'School Fees & Receipts',
          subtitle: 'Check outstanding fees and payment records',
          href: resolveHref('/dashboard/fees/my-fees'),
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          ),
        },
        {
          title: 'School Messages',
          subtitle: 'Inbox and teacher announcements',
          href: resolveHref('/dashboard/messages'),
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          ),
        },
        {
          title: 'Change Password',
          subtitle: 'Update your parent login credentials',
          onClick: () => setChangePasswordOpen(true),
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          ),
        },
        {
          title: 'Public School Website',
          subtitle: 'Visit school homepage',
          href: resolveHref('/'),
          target: '_blank' as const,
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          ),
        },
      ];
    }

    // Default / student role
    return [
      {
        title: 'Check Report Card',
        subtitle: 'View term results and terminal grades',
        href: resolveHref('/results/check'),
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M12 14l9-5-9-5-9 5 9 5z" />
            <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
          </svg>
        ),
      },
      {
        title: 'CBT Online Exams',
        subtitle: 'Computer-based assessment tests',
        href: resolveHref('/portal/cbt'),
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        title: 'Change Password',
        subtitle: 'Update your student account password',
        onClick: () => setChangePasswordOpen(true),
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        ),
      },
    ];
  }, [role, slug, isPathRouted]);

  // Navigation Groups Scoped by User Role
  let navGroups: NavGroup[] = [];

  if (isSchoolAdmin) {
    navGroups = [
      {
        groupName: 'General',
        items: [
          {
            label: 'Overview',
            href: '/dashboard',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            ),
          },
          {
            label: 'Students Directory',
            href: '/dashboard/students',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ),
          },
          {
            label: 'Parents & Guardians',
            href: '/dashboard/parents',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            ),
          },
          {
            label: 'Staff & Teachers',
            href: '/dashboard/staff',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            ),
          },
          {
            label: 'ID Cards',
            href: '/dashboard/id-cards',
            featureKey: 'id_cards',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm3 3h6m-6 4h4m5-4h2m-2 4h2" />
              </svg>
            ),
          },
          {
            label: 'Subjects & Curriculum',
            href: '/dashboard/subjects',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            ),
          },
        ],
      },
      {
        groupName: 'Academics & Evaluation',
        items: [
          {
            label: 'Classroom Hub & Allocations',
            href: '/dashboard/classes',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            ),
          },
          {
            label: 'Results Manager',
            href: '/dashboard/results',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            ),
          },
          {
            label: 'Report Cards',
            href: '/dashboard/results/report-cards',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            ),
          },
          {
            label: 'Result Checker PINs',
            href: '/dashboard/results/pins',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            ),
          },
          {
            label: 'Attendance Register',
            href: '/dashboard/attendance',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ),
          },
          {
            label: 'Staff Attendance',
            href: '/dashboard/attendance/staff',
            featureKey: 'staff_attendance',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            ),
          },
          {
            label: 'Class Timetable',
            href: '/dashboard/timetable',
            featureKey: 'timetable',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
          {
            label: 'Homework & Assignments',
            href: '/dashboard/homework',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            ),
          },
          {
            label: 'CBT Online Exams',
            href: '/dashboard/cbt',
            featureKey: 'feature_cbt_exams',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            ),
          },
        ],
      },
      {
        groupName: 'Finance & Operations',
        items: [
          {
            label: 'School Fees',
            href: '/dashboard/fees',
            featureKey: 'school_fees',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 00-2 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            ),
          },
          {
            label: 'Fee Verifications',
            href: '/dashboard/fees/verifications',
            featureKey: 'school_fees',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
          {
            label: 'Bus Transport',
            href: '/dashboard/transport',
            featureKey: 'feature_bus_tracking',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            ),
          },
          {
            label: 'Subscription & Billing',
            href: '/dashboard/subscription',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            ),
          },
        ],
      },
      {
        groupName: 'Communications',
        items: [
          {
            label: 'Messages',
            href: '/dashboard/messages',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            ),
          },
          {
            label: 'SMS Alerts',
            href: '/dashboard/sms',
            featureKey: 'feature_sms_alerts',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            ),
          },
          {
            label: 'Email Delivery',
            href: '/dashboard/email',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            ),
          },
          {
            label: 'WhatsApp Portal',
            href: '/dashboard/whatsapp',
            featureKey: 'feature_whatsapp_alerts',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            ),
          },
        ],
      },
      {
        groupName: 'Administration & System',
        items: [
          {
            label: 'School Settings',
            href: '/dashboard/settings',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ),
          },
          {
            label: 'Grading System',
            href: '/dashboard/grading',
            featureKey: 'grading_customization',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
          {
            label: 'Student Promotion',
            href: '/dashboard/promotion',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            ),
          },
          {
            label: 'Audit Trail',
            href: '/dashboard/audit-logs',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            ),
          },
          {
            label: 'Background Tasks',
            href: '/dashboard/jobs',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            ),
          },
          {
            label: 'Backups & Recovery',
            href: '/dashboard/backups',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            ),
          },
          {
            label: 'Admission Inquiries',
            href: '/dashboard/admissions',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m-8 4h8m-8 4h5m-9 4h16a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ),
          },
          {
            label: 'Website CMS',
            href: '/dashboard/website',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            ),
          },
        ],
      },
    ];
  } else if (isTeacher) {
    navGroups = [
      {
        groupName: 'General',
        items: [
          {
            label: 'Overview',
            href: '/dashboard',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            ),
          },
          {
            label: 'My Students',
            href: '/dashboard/students',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ),
          },
          {
            label: 'My Attendance',
            href: '/dashboard/attendance/my-attendance',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
              </svg>
            ),
          },
        ],
      },
      {
        groupName: 'Teaching & Academics',
        items: [
          {
            label: 'My Classes & Subjects',
            href: '/dashboard/assignments',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            ),
          },
          {
            label: 'Enter Subject Scores',
            href: '/dashboard/results/entry',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            ),
          },
          {
            label: 'Results Manager',
            href: '/dashboard/results',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            ),
          },
          ...(isFormTeacher
            ? [
                {
                  label: 'Class Attendance',
                  href: '/dashboard/attendance',
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  ),
                },
              ]
            : []),
          {
            label: 'Homework & Assignments',
            href: '/dashboard/homework',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            ),
          },
          {
            label: 'Tests & CBT Exams',
            href: '/dashboard/cbt',
            featureKey: 'feature_cbt_exams',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            ),
          },
          {
            label: 'Class Timetable',
            href: '/dashboard/timetable',
            featureKey: 'timetable',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
        ],
      },
      {
        groupName: 'Communications',
        items: [
          {
            label: 'Messages',
            href: '/dashboard/messages',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            ),
          },
        ],
      },
    ];
  } else if (isParent) {
    navGroups = [
      {
        groupName: 'Parent Portal',
        items: [
          {
            label: 'Overview',
            href: '/portal',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            ),
          },
        ],
      },
      {
        groupName: 'Academics & Reports',
        items: [
          {
            label: 'Academic Results',
            href: '/portal/results',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            ),
          },
          {
            label: 'Attendance Register',
            href: '/portal/attendance',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ),
          },
          {
            label: 'Class Timetable',
            href: '/portal/timetable',
            featureKey: 'timetable',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
          {
            label: 'Homework',
            href: '/portal/homework',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            ),
          },
          {
            label: 'CBT Online Exams',
            href: '/portal/cbt',
            featureKey: 'feature_cbt_exams',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            ),
          },
        ],
      },
      {
        groupName: 'Finance & Services',
        items: [
          {
            label: 'School Fees & Receipts',
            href: '/portal/fees',
            featureKey: 'school_fees',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 00-2 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            ),
          },
          {
            label: 'Bus Tracking',
            href: '/dashboard/transport',
            featureKey: 'feature_bus_tracking',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            ),
          },
        ],
      },
      {
        groupName: 'Account & Security',
        items: [
          {
            label: 'Profile & Password',
            href: '/portal/profile',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            ),
          },
        ],
      },
    ];
  } else {
    // Student Role
    navGroups = [
      {
        groupName: 'Student Portal',
        items: [
          {
            label: 'Overview',
            href: '/portal',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            ),
          },
        ],
      },
      {
        groupName: 'My Academics',
        items: [
          {
            label: 'Academic Results',
            href: '/portal/results',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            ),
          },
          {
            label: 'Attendance Register',
            href: '/portal/attendance',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ),
          },
          {
            label: 'Class Timetable',
            href: '/portal/timetable',
            featureKey: 'timetable',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
          {
            label: 'Homework',
            href: '/portal/homework',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            ),
          },
          {
            label: 'CBT Online Exams',
            href: '/portal/cbt',
            featureKey: 'feature_cbt_exams',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            ),
          },
        ],
      },
      {
        groupName: 'Finance',
        items: [
          {
            label: 'School Fees Status',
            href: '/portal/fees',
            featureKey: 'school_fees',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 00-2 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            ),
          },
        ],
      },
      {
        groupName: 'Account & Security',
        items: [
          {
            label: 'Profile & Password',
            href: '/portal/profile',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            ),
          },
        ],
      },
    ];
  }

  // Find Active Item Label for Top Breadcrumb
  let activeTitle = 'Portal Overview';
  for (const group of navGroups) {
    for (const item of group.items) {
      const targetHref = resolveHref(item.href);
      if (pathname === targetHref || pathname === item.href) {
        activeTitle = item.label;
        break;
      }
    }
  }

  return (
    <div className="ws-shell min-h-screen flex bg-[#f4f3f1] text-[#0a0a0a] font-sans antialiased print:bg-white print:min-h-0">
      {/* ─── Desktop Sidebar (md breakpoint and up) ─── */}
      <aside
        className={`print:hidden hidden md:flex bg-[#f4f3f1] border-r border-[#e4e2dd] flex-col justify-between transition-[width] duration-200 z-40 sticky top-0 h-screen ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Top School Brand Header */}
          <div className="h-14 px-4 flex items-center justify-between border-b border-[#e4e2dd] shrink-0">
            <Link href={resolveHref(isStaffOrAdmin ? '/dashboard' : '/portal')} className="flex items-center gap-2.5 overflow-hidden">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={tenantName}
                  className="w-8 h-8 rounded-[6px] object-cover border border-[#e4e2dd] bg-white shrink-0"
                />
              ) : (
                <div
                  style={{ backgroundColor: primaryColor || '#141414' }}
                  className="w-8 h-8 rounded-[6px] flex items-center justify-center font-semibold text-white text-xs shrink-0"
                >
                  {schoolInitials}
                </div>
              )}

              {!collapsed && (
                <div className="truncate">
                  <span className="font-semibold text-[13px] text-[#0a0a0a] block leading-tight truncate">
                    {tenantName}
                  </span>
                  <span className="text-[11px] text-[#66645e] block truncate">
                    {roleLabel}
                  </span>
                </div>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="w-7 h-7 rounded-[6px] hover:bg-[#e7e5e0] text-[#66645e] hover:text-[#0a0a0a] flex items-center justify-center text-xs transition-colors shrink-0 ml-1 cursor-pointer"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5l7 7-7 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 19l-7-7 7-7" />
                </svg>
              )}
            </button>
          </div>

          {/* Navigation Groups (Scrollable) */}
          <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-4 space-y-5">
            {navGroups.map((group, idx) => (
              <div key={idx} className="space-y-0.5">
                {!collapsed && (
                  <h4 className="px-2.5 pb-1.5 text-[12px] font-medium text-[#66645e]">
                    {tp(group.groupName)}
                  </h4>
                )}
                {group.items.map((item) => {
                  const targetHref = resolveHref(item.href);
                  const isActive = pathname === targetHref || pathname === item.href;
                  const isLocked = Boolean(item.featureKey && enabledFeatures && enabledFeatures[item.featureKey] === false);
                  return (
                    <Link
                      key={item.href}
                      href={targetHref}
                      className={`relative flex items-center gap-2.5 px-2.5 h-8 rounded-lg text-[13px] transition-colors ${
                        isActive
                          ? 'font-semibold'
                          : isLocked
                          ? 'text-[#8b8880] hover:text-[#0a0a0a] hover:bg-[#eceae6]/70'
                          : 'text-[#4f4d48] hover:text-[#0a0a0a] hover:bg-[#eceae6]'
                      } ${collapsed ? 'justify-center px-0' : ''}`}
                      style={
                        isActive
                          ? {
                              backgroundColor: `color-mix(in srgb, ${primaryColor} 12%, transparent)`,
                              color: primaryColor,
                            }
                          : undefined
                      }
                      title={collapsed ? (isLocked ? `${item.label} (Upgrade required)` : item.label) : undefined}
                    >
                      {isActive && !collapsed && (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
                          style={{ backgroundColor: primaryColor }}
                        />
                      )}
                      <span
                        className={`shrink-0 relative ${isActive ? '' : isLocked ? 'text-[#9b9890]' : 'text-[#66645e]'}`}
                        style={isActive ? { color: primaryColor } : undefined}
                      >
                        {item.icon}
                        {collapsed && isLocked && (
                          <span className="absolute -top-1.5 -right-1.5">
                            <svg className="w-3 h-3 text-[#8f4f0e]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" /></svg>
                          </span>
                        )}
                      </span>
                      {!collapsed && (
                        <span className="flex-1 truncate flex items-center justify-between gap-1.5">
                          <span className="truncate">{tp(item.label)}</span>
                          {isLocked && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#fffbeb] text-[#8f4f0e] border border-[#e9d8a6] font-medium shrink-0 text-[10px]">
                              Upgrade
                            </span>
                          )}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* User Footer & Logout */}
          <div className="p-3 border-t border-[#e4e2dd] shrink-0 space-y-2 bg-[#f4f3f1]">
            {!collapsed ? (
              <div className="px-2.5 py-2 rounded-[6px] bg-white border border-[#e4e2dd] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-7 h-7 rounded-[6px] overflow-hidden bg-[#141414] text-white font-medium flex items-center justify-center text-[11px] shrink-0">
                    {userAvatar ? (
                      <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                    ) : (
                      getUserInitials(userName)
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <span className="text-xs font-medium text-[#0a0a0a] block truncate">{userName}</span>
                    <span className="text-[11px] text-[#66645e] block truncate">
                      {roleLabel}
                    </span>
                  </div>
                </div>
                <Link
                  href={resolveHref('/')}
                  target="_blank"
                  className="p-1.5 rounded-[6px] text-[#66645e] hover:text-[#0a0a0a] hover:bg-[#f4f3f1] shrink-0 transition-colors"
                  title="Open school website"
                  aria-label="Open school website"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 18c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3M3.5 12h17" /></svg>
                </Link>
              </div>
            ) : (
              <div className="flex justify-center">
                <Link
                  href={resolveHref('/')}
                  target="_blank"
                  className="p-2 rounded-[6px] bg-white border border-[#e4e2dd] text-[#66645e] hover:text-[#0a0a0a]"
                  title="Open school website"
                  aria-label="Open school website"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 18c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3M3.5 12h17" /></svg>
                </Link>
              </div>
            )}

            <form action="/api/tenant/auth/logout" method="POST">
              <input type="hidden" name="slug" value={slug} />
              <button
                type="submit"
                className={`w-full h-8 px-2.5 rounded-[6px] text-xs font-medium bg-transparent hover:bg-[#eceae6] text-[#4f4d48] hover:text-[#b8292f] transition-colors flex items-center gap-2 cursor-pointer ${
                  collapsed ? 'justify-center px-0' : 'justify-between'
                }`}
                title="Sign out"
              >
                {!collapsed && <span>{t('tenant.signOut', 'Sign out')}</span>}
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ─── Main Content Layout Shell ─── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen print:min-h-0 print:block bg-[#f4f3f1]">
        {/* ─── Sticky Top Header ─── */}
        <header className="print:hidden sticky top-0 z-30 bg-white border-b border-[#e4e2dd] h-14 px-4 sm:px-6 flex items-center justify-between">
          {/* Mobile Drawer Hamburger & Active Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-1.5 rounded-[6px] bg-[#f4f3f1] text-[#0a0a0a] border border-[#e4e2dd] focus:outline-none cursor-pointer"
              aria-label="Open navigation menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[13px] text-[#66645e] hidden sm:inline truncate">{tenantName}</span>
              <span className="text-[#d4d1ca] hidden sm:inline">/</span>
              <span className="font-medium text-[#0a0a0a] text-[14px] truncate">
                {tp(activeTitle)}
              </span>
            </div>
          </div>

          {/* Right Header Controls (Language, Search, Bell, Profile) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher variant="tenant" />
            {/* Desktop Search Button */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden sm:flex items-center gap-2 h-8 px-3 bg-[#f4f3f1] hover:bg-[#eceae6] border border-[#e4e2dd] rounded-[6px] text-xs text-[#66645e] hover:text-[#0a0a0a] transition-colors cursor-pointer"
              title="Quick search (Ctrl + K)"
            >
              <svg className="w-3.5 h-3.5 text-[#66645e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>{t('tenant.searchWorkspace', 'Search workspace')}</span>
              <kbd className="px-1.5 py-0.5 bg-white border border-[#e4e2dd] rounded text-[10px] text-[#66645e]">
                Ctrl K
              </kbd>
            </button>

            {/* Mobile Search Icon Button */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="sm:hidden p-1.5 rounded-[6px] bg-[#f4f3f1] text-[#66645e] hover:text-[#0a0a0a] border border-[#e4e2dd]"
              aria-label="Search workspace"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            <NotificationBell slug={slug} />

            {/* User Profile Dropdown Trigger */}
            <div className="relative pl-2 border-l border-[#e4e2dd]" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 px-2 py-1 rounded-[6px] hover:bg-[#f4f3f1] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#141414]"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                title="Account and profile"
              >
                <div className="relative w-7 h-7 rounded-[6px] overflow-hidden bg-[#141414] text-white flex items-center justify-center text-[11px] font-medium shrink-0">
                  {userAvatar ? (
                    <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                  ) : (
                    <span>{getUserInitials(userName)}</span>
                  )}
                </div>
                <div className="hidden sm:block text-left max-w-[140px]">
                  <span className="text-xs font-medium text-[#0a0a0a] block leading-tight truncate">
                    {userName}
                  </span>
                  <span className="text-[11px] text-[#66645e] block truncate">
                    {roleLabel}
                  </span>
                </div>
                <svg
                  className={`hidden sm:block w-3.5 h-3.5 text-[#66645e] transition-transform duration-150 ${
                    userMenuOpen ? 'rotate-180 text-[#0a0a0a]' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {userMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-72 bg-white rounded-[8px] shadow-lg border border-[#e4e2dd] py-2 z-50"
                  role="menu"
                >
                  {/* User Profile Card with Avatar Upload */}
                  <div className="px-4 py-3 border-b border-[#efede9] flex items-center gap-3">
                    <div className="relative group shrink-0">
                      <div className="w-11 h-11 rounded-[6px] overflow-hidden bg-[#141414] text-white flex items-center justify-center font-medium text-sm border border-[#e4e2dd]">
                        {userAvatar ? (
                          <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                        ) : (
                          <span>{getUserInitials(userName)}</span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => avatarFileInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        className="absolute inset-0 bg-[#0a0a0a]/70 rounded-[6px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer"
                        title="Upload profile photo"
                      >
                        {isUploadingAvatar ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="text-[10px] font-medium">Edit</span>
                        )}
                      </button>

                      <input
                        ref={avatarFileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={handleAvatarUpload}
                      />
                    </div>

                    <div className="overflow-hidden flex-1 min-w-0">
                      <span className="text-xs font-semibold text-[#0a0a0a] truncate block leading-tight">
                        {userName}
                      </span>
                      <span className="text-[11px] text-[#66645e] truncate block mb-1">
                        {userEmail || 'Active user'}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#f4f3f1] text-[#3d3d3d] border border-[#e4e2dd]">
                        {roleLabel}
                      </span>
                    </div>
                  </div>

                  {avatarUploadMsg && (
                    <div
                      className={`px-4 py-1.5 text-xs font-medium ${
                        avatarUploadMsg.type === 'error'
                          ? 'bg-[#ffedea] text-[#831c1e]'
                          : 'bg-[#dcfae5] text-[#04250e]'
                      }`}
                    >
                      {avatarUploadMsg.text}
                    </div>
                  )}

                  {/* Role-Specific Navigation Menu Items */}
                  <div className="p-1.5 space-y-0.5">
                    {roleMenuItems.map((item, idx) =>
                      item.onClick ? (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            item.onClick?.();
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-[6px] hover:bg-[#f4f3f1] transition-colors text-[#0a0a0a] cursor-pointer"
                        >
                          <div className="w-7 h-7 rounded-[6px] bg-[#f4f3f1] border border-[#e4e2dd] flex items-center justify-center text-[#4f4d48] shrink-0">
                            {item.icon}
                          </div>
                          <div className="overflow-hidden flex-1 min-w-0">
                            <span className="text-xs font-medium text-[#0a0a0a] block truncate">
                              {item.title}
                            </span>
                            <span className="text-[11px] text-[#66645e] block truncate">
                              {item.subtitle}
                            </span>
                          </div>
                        </button>
                      ) : (
                        <Link
                          key={idx}
                          href={item.href || '#'}
                          target={item.target}
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-3 py-2 rounded-[6px] hover:bg-[#f4f3f1] transition-colors text-[#0a0a0a]"
                        >
                          <div className="w-7 h-7 rounded-[6px] bg-[#f4f3f1] border border-[#e4e2dd] flex items-center justify-center text-[#4f4d48] shrink-0">
                            {item.icon}
                          </div>
                          <div className="overflow-hidden flex-1 min-w-0">
                            <span className="text-xs font-medium text-[#0a0a0a] block truncate">
                              {item.title}
                            </span>
                            <span className="text-[11px] text-[#66645e] block truncate">
                              {item.subtitle}
                            </span>
                          </div>
                          {item.target === '_blank' && (
                            <svg className="w-3.5 h-3.5 text-[#66645e] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          )}
                        </Link>
                      )
                    )}
                  </div>

                  {/* Sign Out Action */}
                  <div className="p-1.5 border-t border-[#efede9]">
                    <form action="/api/tenant/auth/logout" method="POST">
                      <input type="hidden" name="slug" value={slug} />
                      <button
                        type="submit"
                        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-[#b8292f] hover:bg-[#ffedea] rounded-[6px] transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          <span>Sign out</span>
                        </span>
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ─── Main Page Content Container ─── */}
        <main className="flex-1 p-4 sm:p-6 lg:p-7 max-w-[1280px] w-full mx-auto print:p-0 print:m-0 print:max-w-none print:w-full">{children}</main>
      </div>

      {/* ─── Mobile Slide-Over Drawer Overlay (< md) ─── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-[#0a0a0a]/45 transition-opacity"
            onClick={() => setMobileOpen(false)}
          />

          <div className="relative flex-1 max-w-xs w-full bg-[#f4f3f1] border-r border-[#e4e2dd] flex flex-col justify-between p-4 z-10">
            <div className="flex flex-col h-full overflow-hidden">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#e4e2dd] shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={tenantName}
                      className="w-8 h-8 rounded-[6px] object-cover border border-[#e4e2dd] bg-white shrink-0"
                    />
                  ) : (
                    <div
                      style={{ backgroundColor: primaryColor || '#141414' }}
                      className="w-8 h-8 rounded-[6px] flex items-center justify-center font-semibold text-white text-xs shrink-0"
                    >
                      {schoolInitials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="font-semibold text-[13px] text-[#0a0a0a] block leading-tight truncate">
                      {tenantName}
                    </span>
                    <span className="text-[11px] text-[#66645e] block truncate">
                      {roleLabel}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-[6px] hover:bg-[#e7e5e0] text-[#66645e] hover:text-[#0a0a0a]"
                  aria-label="Close navigation menu"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Drawer Nav Items */}
              <nav className="flex-1 overflow-y-auto space-y-4 pr-1">
                {navGroups.map((group, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <h4 className="px-2.5 pb-1 text-[12px] font-medium text-[#66645e]">
                      {group.groupName}
                    </h4>
                    {group.items.map((item) => {
                      const targetHref = resolveHref(item.href);
                      const isActive = pathname === targetHref || pathname === item.href;
                      const isLocked = Boolean(item.featureKey && enabledFeatures && enabledFeatures[item.featureKey] === false);
                      return (
                        <Link
                          key={item.href}
                          href={targetHref}
                          onClick={() => setMobileOpen(false)}
                          className={`relative flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-[13px] transition-colors ${
                            isActive
                              ? 'font-semibold'
                              : isLocked
                              ? 'text-[#8b8880] hover:text-[#0a0a0a] hover:bg-[#eceae6]/70'
                              : 'text-[#4f4d48] hover:text-[#0a0a0a] hover:bg-[#eceae6]'
                          }`}
                          style={
                            isActive
                              ? {
                                  backgroundColor: `color-mix(in srgb, ${primaryColor} 12%, transparent)`,
                                  color: primaryColor,
                                }
                              : undefined
                          }
                        >
                          <span
                            className={`shrink-0 ${isActive ? '' : isLocked ? 'text-[#9b9890]' : 'text-[#66645e]'}`}
                            style={isActive ? { color: primaryColor } : undefined}
                          >
                            {item.icon}
                          </span>
                          <span className="flex-1 truncate flex items-center justify-between gap-1.5">
                            <span className="truncate">{item.label}</span>
                            {isLocked && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#fffbeb] text-[#8f4f0e] border border-[#e9d8a6] font-medium shrink-0 text-[10px]">
                                Upgrade
                              </span>
                            )}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>

              {/* Drawer User Footer & Logout */}
              <div className="pt-3 border-t border-[#e4e2dd] shrink-0 space-y-2">
                <div className="px-2.5 py-2 rounded-[6px] bg-white border border-[#e4e2dd] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-7 h-7 rounded-[6px] overflow-hidden bg-[#141414] text-white font-medium flex items-center justify-center text-[11px] shrink-0">
                      {userAvatar ? (
                        <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                      ) : (
                        getUserInitials(userName)
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <span className="text-xs font-medium text-[#0a0a0a] block truncate">{userName}</span>
                      <span className="text-[11px] text-[#66645e] block truncate">
                        {userEmail || roleLabel}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={resolveHref('/')}
                    target="_blank"
                    className="p-1.5 rounded-[6px] text-[#66645e] hover:text-[#0a0a0a] shrink-0"
                    title="Open school website"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 18c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3M3.5 12h17" /></svg>
                  </Link>
                </div>
                <form action="/api/tenant/auth/logout" method="POST">
                  <input type="hidden" name="slug" value={slug} />
                  <button
                    type="submit"
                    className="w-full h-9 px-3 rounded-[6px] text-xs font-medium bg-white hover:bg-[#ffedea] hover:text-[#b8292f] text-[#4f4d48] border border-[#e4e2dd] transition-colors flex items-center justify-between"
                  >
                    <span>Sign out</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Command Palette (Ctrl+K) ─── */}
      <CommandPalette
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        items={useMemo(() => {
          const itemsList: CommandItem[] = [];
          navGroups.forEach((g) => {
            g.items.forEach((item) => {
              itemsList.push({
                id: item.href,
                title: item.label,
                category: g.groupName,
                href: resolveHref(item.href),
                icon: item.icon,
                keywords: [item.label.toLowerCase(), g.groupName.toLowerCase()],
              });
            });
          });

          if (isTeacher) {
            itemsList.push(
              {
                id: 'cmd-enter-scores',
                title: 'Enter Academic Scores',
                category: 'Quick Action',
                href: resolveHref('/dashboard/results/entry'),
                keywords: ['scores', 'grades', 'ca', 'exam'],
              },
              {
                id: 'cmd-attendance',
                title: 'Take Class Attendance',
                category: 'Quick Action',
                href: resolveHref('/dashboard/attendance'),
                keywords: ['attendance', 'roll call', 'present'],
              }
            );
          }
          if (isSchoolAdmin) {
            itemsList.push(
              {
                id: 'cmd-form-teachers',
                title: 'Classroom Hub & Allocations',
                category: 'Quick Action',
                href: resolveHref('/dashboard/classes'),
                keywords: ['classroom', 'classes', 'form teacher', 'subject teacher', 'allocation'],
              },
              {
                id: 'cmd-enter-scores',
                title: 'Enter Academic Scores',
                category: 'Quick Action',
                href: resolveHref('/dashboard/results/entry'),
                keywords: ['scores', 'grades', 'ca', 'exam'],
              },
              {
                id: 'cmd-broadsheet',
                title: 'Terminal Results Broadsheet',
                category: 'Quick Action',
                href: resolveHref('/dashboard/results/broadsheet'),
                keywords: ['broadsheet', 'review', 'terminal'],
              },
              {
                id: 'cmd-export-csv',
                title: 'Data Export (CSV / JSON)',
                category: 'Quick Action',
                href: resolveHref('/dashboard/export'),
                keywords: ['export', 'csv', 'download', 'backup'],
              },
              {
                id: 'cmd-settings',
                title: 'School Settings & Configuration',
                category: 'Quick Action',
                href: resolveHref('/dashboard/settings'),
                keywords: ['settings', 'branding', 'pin', 'classes', 'pricing', 'configuration', 'password'],
              }
            );
          }
          return itemsList;
        }, [navGroups, isStaffOrAdmin, isSchoolAdmin])}
      />

      {/* ─── Change Password Modal ─── */}
      {changePasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0a]/50">
          <div
            className="fixed inset-0"
            onClick={() => {
              if (!changingPassword) setChangePasswordOpen(false);
            }}
          />
          <div className="relative w-full max-w-md bg-white rounded-[8px] border border-[#e4e2dd] p-6 z-10 overflow-hidden">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Change Password</h3>
                  <p className="text-xs text-slate-500">Update your security credentials</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChangePasswordOpen(false)}
                disabled={changingPassword}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {passwordError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
                {passwordSuccess}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-3 py-2 pr-14 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPass ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-3 py-2 pr-14 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600"
                  >
                    {showNewPass ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full px-3 py-2 pr-14 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPass ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setChangePasswordOpen(false)}
                  disabled={changingPassword}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="px-5 py-2 text-xs font-medium text-white bg-[#141414] hover:bg-[#2a2a2a] disabled:opacity-50 rounded-[6px] transition-colors flex items-center gap-2 cursor-pointer"
                >
                  {changingPassword ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
