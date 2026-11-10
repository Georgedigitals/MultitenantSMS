import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { ensureTenantPeriods } from '@/lib/timetable';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    if (!slug) return NextResponse.json({ error: 'slug parameter required' }, { status: 400 });

    const tenant = await getTenantContext({ slug });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    if (!tenant.hasFeature('timetable')) return NextResponse.json({ error: 'Class Timetable is not enabled for this school.' }, { status: 403 });

    const periods = await ensureTenantPeriods(tenant.id);
    return NextResponse.json({ periods });
  } catch (err: any) {
    console.error('Error fetching periods:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch periods' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, id, name, startTime, endTime, orderIndex, isBreak = false } = body;

    if (!slug || !name || !startTime || !endTime || orderIndex === undefined) {
      return NextResponse.json(
        { error: 'slug, name, startTime, endTime, and orderIndex are required' },
        { status: 400 }
      );
    }

    const tenant = await getTenantContext({ slug });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    if (!tenant.hasFeature('timetable')) return NextResponse.json({ error: 'Class Timetable is not enabled for this school.' }, { status: 403 });

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Admin authorization required' }, { status: 403 });
    }

    if (id) {
      const updated = await prisma.timetablePeriod.update({
        where: { id },
        data: {
          name: name.trim(),
          startTime: startTime.trim(),
          endTime: endTime.trim(),
          orderIndex: Number(orderIndex),
          isBreak: Boolean(isBreak),
        },
      });
      return NextResponse.json({ success: true, period: updated });
    } else {
      const created = await prisma.timetablePeriod.create({
        data: {
          tenantId: tenant.id,
          name: name.trim(),
          startTime: startTime.trim(),
          endTime: endTime.trim(),
          orderIndex: Number(orderIndex),
          isBreak: Boolean(isBreak),
        },
      });
      return NextResponse.json({ success: true, period: created });
    }
  } catch (err: any) {
    console.error('Error saving period:', err);
    return NextResponse.json({ error: err.message || 'Failed to save period' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const id = searchParams.get('id');

    if (!slug || !id) return NextResponse.json({ error: 'slug and id required' }, { status: 400 });

    const tenant = await getTenantContext({ slug });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    if (!tenant.hasFeature('timetable')) return NextResponse.json({ error: 'Class Timetable is not enabled for this school.' }, { status: 403 });

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Admin authorization required' }, { status: 403 });
    }

    await prisma.timetablePeriod.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting period:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete period' }, { status: 500 });
  }
}
