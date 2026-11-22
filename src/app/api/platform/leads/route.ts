import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const SETTING_KEY = 'platformLeadsJson';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body?.name || '').trim();
    const email = String(body?.email || '').trim();
    const phone = String(body?.phone || '').trim();
    const schoolName = String(body?.schoolName || '').trim();
    const message = String(body?.message || '').trim();
    const sourcePage = String(body?.sourcePage || '/').trim().slice(0, 120);

    if (!name || name.length < 2) {
      return NextResponse.json({ error: 'Please enter your full name.' }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    if (!message || message.length < 5) {
      return NextResponse.json({ error: 'Please enter a short message.' }, { status: 400 });
    }

    const row = await prisma.platformSetting.findUnique({ where: { key: SETTING_KEY } });
    let existing: any[] = [];
    if (row?.value) {
      try {
        const parsed = JSON.parse(row.value);
        if (Array.isArray(parsed)) existing = parsed;
      } catch {
        existing = [];
      }
    }

    const lead = {
      id: `lead-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.slice(0, 100),
      email: email.slice(0, 140),
      phone: phone.slice(0, 40) || undefined,
      schoolName: schoolName.slice(0, 120) || undefined,
      message: message.slice(0, 2000),
      sourcePage,
      status: 'new',
      createdAt: new Date().toISOString(),
    };

    const next = [lead, ...existing].slice(0, 500);
    await prisma.platformSetting.upsert({
      where: { key: SETTING_KEY },
      create: { key: SETTING_KEY, value: JSON.stringify(next) },
      update: { value: JSON.stringify(next) },
    });

    return NextResponse.json({
      success: true,
      message: 'Thank you! Your inquiry has been received and our team will reach out shortly.',
    });
  } catch {
    return NextResponse.json({ error: 'Could not submit inquiry. Please try again.' }, { status: 500 });
  }
}
