import { NextResponse } from 'next/server';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized Super Admin access' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();

  const tenants = await prisma.tenant.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined,
    include: {
      plan: { select: { name: true } },
      _count: { select: { students: true, staff: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return NextResponse.json({
    success: true,
    tenants: tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      planName: t.plan?.name || 'Starter',
      students: t._count.students,
      staff: t._count.staff,
    })),
  });
}
