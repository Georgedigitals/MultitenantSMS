import { NextResponse } from 'next/server';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { tenantHasFeature } from '@/lib/features';
import prisma from '@/lib/prisma';
import { getTenantDb } from '@/lib/tenant-db';

export async function GET(request: Request) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasFeature = await tenantHasFeature(auth.tenant.id, 'school_fees');
    if (!hasFeature) {
      return NextResponse.json({ error: 'School fee tracking is not enabled on your plan tier' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const termId = searchParams.get('termId');
    const classLevelId = searchParams.get('classLevelId');

    if (!termId) {
      return NextResponse.json({ error: 'termId query parameter is required' }, { status: 400 });
    }

    const feeItems = await prisma.feeItem.findMany({
      where: {
        tenantId: auth.tenant.id,
        termId,
        ...(classLevelId
          ? {
              OR: [{ classLevelId: null }, { classLevelId }],
            }
          : {}),
      },
      include: {
        classLevel: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ feeItems });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth || (auth.user.role !== 'school_admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized — Admin role required' }, { status: 403 });
    }

    const hasFeature = await tenantHasFeature(auth.tenant.id, 'school_fees');
    if (!hasFeature) {
      return NextResponse.json({ error: 'School fee tracking is not enabled on your plan tier' }, { status: 403 });
    }

    const body = await request.json();
    const { termId, classLevelId, name, amount } = body;

    if (!termId || !name || amount === undefined || amount === null) {
      return NextResponse.json(
        { error: 'termId, name, and amount are required' },
        { status: 400 }
      );
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 });
    }

    // Verify term belongs to tenant
    const term = await prisma.term.findUnique({
      where: { id: termId },
      include: { session: true },
    });
    if (!term || term.session.tenantId !== auth.tenant.id) {
      return NextResponse.json({ error: 'Invalid term' }, { status: 400 });
    }

    const feeItem = await prisma.feeItem.create({
      data: {
        tenantId: auth.tenant.id,
        termId,
        classLevelId: classLevelId || null,
        name: name.trim(),
        amount: numAmount,
      },
      include: {
        classLevel: true,
      },
    });

    return NextResponse.json({ feeItem }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth || (auth.user.role !== 'school_admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized — Admin role required' }, { status: 403 });
    }

    const hasFeature = await tenantHasFeature(auth.tenant.id, 'school_fees');
    if (!hasFeature) {
      return NextResponse.json({ error: 'School fee tracking is not enabled on your plan tier' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, amount, classLevelId } = body;

    if (!id) {
      return NextResponse.json({ error: 'Fee item ID is required' }, { status: 400 });
    }

    const existing = await prisma.feeItem.findUnique({
      where: { id },
    });

    if (!existing || existing.tenantId !== auth.tenant.id) {
      return NextResponse.json({ error: 'Fee item not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (name && typeof name === 'string' && name.trim()) {
      updateData.name = name.trim();
    }
    if (amount !== undefined && amount !== null) {
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 });
      }
      updateData.amount = numAmount;
    }
    if (classLevelId !== undefined) {
      updateData.classLevelId = classLevelId === 'all' || !classLevelId ? null : classLevelId;
    }

    const db = getTenantDb(auth.tenant.id);
    const updated = await db.feeItem.update({
      where: { id },
      data: updateData,
      include: { classLevel: true },
    });

    return NextResponse.json({ success: true, feeItem: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getTenantUserFromCookies();
    if (!auth || auth.user.role !== 'school_admin') {
      return NextResponse.json({ error: 'Unauthorized — Admin role required' }, { status: 403 });
    }

    const hasFeature = await tenantHasFeature(auth.tenant.id, 'school_fees');
    if (!hasFeature) {
      return NextResponse.json({ error: 'School fee tracking is not enabled on your plan tier' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    }

    const existing = await prisma.feeItem.findUnique({
      where: { id },
    });

    if (!existing || existing.tenantId !== auth.tenant.id) {
      return NextResponse.json({ error: 'Fee item not found' }, { status: 404 });
    }

    const db = getTenantDb(auth.tenant.id);
    await db.feeItem.delete({ where: { id } });

    return NextResponse.json({ success: true, message: `Fee item "${existing.name}" deleted successfully.` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

