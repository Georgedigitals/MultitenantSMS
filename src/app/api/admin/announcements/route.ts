import { NextResponse } from 'next/server';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import prisma from '@/lib/prisma';

export interface PlatformAnnouncement {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'success';
  targetPlan: string; // 'all' or plan name
  ctaLabel?: string;
  ctaHref?: string;
  active: boolean;
  expiresAt?: string;
  createdAt: string;
  createdBy: string;
}

const SETTING_KEY = 'platformAnnouncementsJson';

async function readAnnouncements(): Promise<PlatformAnnouncement[]> {
  const row = await prisma.platformSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAnnouncements(items: PlatformAnnouncement[]) {
  await prisma.platformSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(items) },
    update: { value: JSON.stringify(items) },
  });
}

export async function GET() {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized Super Admin access' }, { status: 401 });
  }
  const items = await readAnnouncements();
  return NextResponse.json({ success: true, announcements: items });
}

export async function POST(req: Request) {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized Super Admin access' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const action = body?.action || 'create';
    const current = await readAnnouncements();

    if (action === 'toggle') {
      const id = String(body?.id || '');
      const updated = current.map((item) =>
        item.id === id ? { ...item, active: !item.active } : item
      );
      await writeAnnouncements(updated);
      return NextResponse.json({ success: true, announcements: updated });
    }

    if (action === 'delete') {
      const id = String(body?.id || '');
      const updated = current.filter((item) => item.id !== id);
      await writeAnnouncements(updated);
      return NextResponse.json({ success: true, announcements: updated });
    }

    const title = String(body?.title || '').trim();
    const message = String(body?.message || '').trim();
    if (!title || !message) {
      return NextResponse.json({ error: 'Title and message are required.' }, { status: 400 });
    }

    const severity: PlatformAnnouncement['severity'] =
      body?.severity === 'warning' || body?.severity === 'success' ? body.severity : 'info';

    const newItem: PlatformAnnouncement = {
      id: `ann-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      title: title.slice(0, 120),
      message: message.slice(0, 500),
      severity,
      targetPlan: String(body?.targetPlan || 'all').trim() || 'all',
      ctaLabel: body?.ctaLabel ? String(body.ctaLabel).trim().slice(0, 50) : undefined,
      ctaHref: body?.ctaHref ? String(body.ctaHref).trim().slice(0, 200) : undefined,
      active: body?.active !== false,
      expiresAt: body?.expiresAt ? String(body.expiresAt) : undefined,
      createdAt: new Date().toISOString(),
      createdBy: auth.superAdmin.name || 'Super Admin',
    };

    const next = [newItem, ...current].slice(0, 50);
    await writeAnnouncements(next);
    return NextResponse.json({ success: true, announcements: next });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to save announcement' }, { status: 500 });
  }
}
