import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenantAccess } from '@/lib/auth/tenant-access';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: 'Missing tenant slug' }, { status: 400 });
  }

  const access = await requireTenantAccess(slug, ['school_admin', 'teacher', 'parent', 'student']);
  if (!access.authorized || !access.tenant) {
    return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
  }

  const hasFeature = await access.tenant.hasFeature('feature_bus_tracking');
  if (!hasFeature) {
    return NextResponse.json(
      { error: 'School Bus & Fleet Tracking module is not enabled for your subscription plan' },
      { status: 403 }
    );
  }

  const vehicles = await prisma.transportVehicle.findMany({
    where: { tenantId: access.tenant.id },
    include: { routes: true },
    orderBy: { createdAt: 'desc' },
  });

  const routes = await prisma.transportRoute.findMany({
    where: { tenantId: access.tenant.id },
    include: { vehicle: true, subscriptions: { include: { student: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const userRole = access.user?.role;
  const students = userRole === 'school_admin'
    ? await prisma.student.findMany({
        where: { tenantId: access.tenant.id },
        orderBy: { name: 'asc' },
      })
    : [];

  return NextResponse.json({ vehicles, routes, students, userRole, hasFeature: true });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, slug, vehicleData, routeData, subscriptionData } = body;

    if (!slug) {
      return NextResponse.json({ error: 'Missing tenant slug' }, { status: 400 });
    }

    const access = await requireTenantAccess(slug, ['school_admin']);
    if (!access.authorized || !access.tenant) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
    }

    const hasFeature = await access.tenant.hasFeature('feature_bus_tracking');
    if (!hasFeature) {
      return NextResponse.json({ error: 'School Bus Tracking module disabled' }, { status: 403 });
    }

    if (action === 'create_vehicle') {
      const { vehicleNo, driverName, driverPhone, capacity } = vehicleData;
      const vehicle = await prisma.transportVehicle.create({
        data: {
          tenantId: access.tenant.id,
          vehicleNo,
          driverName,
          driverPhone,
          capacity: parseInt(capacity) || 30,
        },
      });
      return NextResponse.json({ vehicle });
    }

    if (action === 'create_route') {
      const { routeName, vehicleId, pickupTime, dropoffTime } = routeData;
      if (vehicleId) {
        const vehicle = await prisma.transportVehicle.findFirst({
          where: { id: vehicleId, tenantId: access.tenant.id },
          select: { id: true },
        });
        if (!vehicle) return NextResponse.json({ error: 'Vehicle not found for this school.' }, { status: 400 });
      }
      const route = await prisma.transportRoute.create({
        data: {
          tenantId: access.tenant.id,
          routeName,
          vehicleId: vehicleId || null,
          pickupTime: pickupTime || '07:00 AM',
          dropoffTime: dropoffTime || '03:30 PM',
        },
      });
      return NextResponse.json({ route });
    }

    if (action === 'subscribe_student') {
      const { studentId, routeId, stopName } = subscriptionData;
      const [student, route] = await Promise.all([
        prisma.student.findFirst({ where: { id: studentId, tenantId: access.tenant.id }, select: { id: true } }),
        prisma.transportRoute.findFirst({ where: { id: routeId, tenantId: access.tenant.id }, select: { id: true } }),
      ]);
      if (!student || !route) {
        return NextResponse.json({ error: 'Student or route not found for this school.' }, { status: 400 });
      }
      const subscription = await prisma.studentBusSubscription.upsert({
        where: { studentId_routeId: { studentId, routeId } },
        update: { stopName: stopName || 'Main Gate Stop', status: 'active' },
        create: { studentId, routeId, stopName: stopName || 'Main Gate Stop', status: 'active' },
      });
      return NextResponse.json({ subscription });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Transport action failed' }, { status: 500 });
  }
}
