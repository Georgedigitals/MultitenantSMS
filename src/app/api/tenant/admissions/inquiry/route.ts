import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createBulkNotifications } from '@/lib/notifications';
import { findTenantBySlugOrDomain } from '@/lib/tenant';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantSlug = typeof body.tenantSlug === 'string' ? body.tenantSlug.trim().toLowerCase() : '';
    const clean = (value: unknown, maxLength: number) => typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
    const parentName = clean(body.parentName, 120);
    const parentEmail = clean(body.parentEmail, 254);
    const parentPhone = clean(body.parentPhone, 40);
    const studentName = clean(body.studentName, 120);
    const classLevel = clean(body.classLevel, 80);
    const notes = clean(body.notes, 1000);

    if (!tenantSlug || !parentName || !parentPhone || !studentName) {
      return NextResponse.json(
        { error: 'Parent name, phone number, and student name are required' },
        { status: 400 }
      );
    }

    const tenant = await findTenantBySlugOrDomain(tenantSlug);
    if (!tenant) return NextResponse.json({ error: 'School not found' }, { status: 404 });

    const schoolAdmins = await prisma.tenantUser.findMany({
      where: { tenantId: tenant.id, role: 'school_admin', isActive: true },
      select: { id: true },
    });
    if (schoolAdmins.length > 0) {
      const message = [
        `New admission inquiry for ${studentName} (${classLevel || 'General'})`,
        `Parent / guardian: ${parentName}`,
        `Phone: ${parentPhone}`,
        parentEmail ? `Email: ${parentEmail}` : '',
        notes ? `Notes: ${notes}` : '',
      ].filter(Boolean).join('\n');
      await createBulkNotifications(schoolAdmins.map((admin) => ({
        tenantId: tenant.id,
        recipientType: 'school_admin',
        recipientId: admin.id,
        type: 'admissions_inquiry',
        message,
        link: `/${tenant.slug}/dashboard/admissions`,
      })));
    }

    return NextResponse.json({ success: true, message: 'Inquiry received' });
  } catch (err: any) {
    console.error('Admission inquiry error:', err);
    return NextResponse.json({ error: 'Failed to process inquiry' }, { status: 500 });
  }
}
