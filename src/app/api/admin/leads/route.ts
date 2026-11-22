import { NextResponse } from 'next/server';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import prisma from '@/lib/prisma';

export interface PlatformLead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  schoolName?: string;
  message: string;
  sourcePage: string;
  status: 'new' | 'contacted' | 'converted' | 'archived';
  notes?: string;
  createdAt: string;
}

const SETTING_KEY = 'platformLeadsJson';

async function readLeads(): Promise<PlatformLead[]> {
  const row = await prisma.platformSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLeads(leads: PlatformLead[]) {
  await prisma.platformSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(leads) },
    update: { value: JSON.stringify(leads) },
  });
}

export async function GET() {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized Super Admin access' }, { status: 401 });
  }
  const leads = await readLeads();
  return NextResponse.json({ success: true, leads });
}

export async function POST(req: Request) {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized Super Admin access' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const action = body?.action;
    const id = String(body?.id || '');
    const current = await readLeads();

    if (action === 'delete') {
      const updated = current.filter((l) => l.id !== id);
      await writeLeads(updated);
      return NextResponse.json({ success: true, leads: updated });
    }

    if (action === 'update') {
      const allowedStatuses = new Set(['new', 'contacted', 'converted', 'archived']);
      const updated = current.map((l) => {
        if (l.id !== id) return l;
        return {
          ...l,
          status: allowedStatuses.has(body?.status) ? body.status : l.status,
          notes: body?.notes !== undefined ? String(body.notes).slice(0, 1000) : l.notes,
        };
      });
      await writeLeads(updated);
      return NextResponse.json({ success: true, leads: updated });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update lead' }, { status: 500 });
  }
}
