import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const plan = (searchParams.get('plan') || '').trim().toLowerCase();

    const row = await prisma.platformSetting.findUnique({
      where: { key: 'platformAnnouncementsJson' },
    });
    if (!row?.value) {
      return NextResponse.json({ success: true, announcements: [] });
    }

    const parsed = JSON.parse(row.value);
    const now = Date.now();
    const active = (Array.isArray(parsed) ? parsed : []).filter((item: any) => {
      if (!item?.active) return false;
      if (item.expiresAt && new Date(item.expiresAt).getTime() < now) return false;
      const target = String(item.targetPlan || 'all').toLowerCase();
      if (target !== 'all' && plan && target !== plan) return false;
      return true;
    });

    return NextResponse.json({ success: true, announcements: active.slice(0, 3) });
  } catch {
    return NextResponse.json({ success: true, announcements: [] });
  }
}
