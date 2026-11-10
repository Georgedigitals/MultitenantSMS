import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import prisma from '@/lib/prisma';
import ParentsClient from './parents-client';

interface ParentsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ParentsPage({ params }: ParentsPageProps) {
  const { slug } = await params;
  const tenant = await getTenantContext({ slug });

  if (!tenant) {
    notFound();
  }

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) {
    redirect('/login');
  }

  // Only school administrators can view and manage the parents directory
  if (auth.user.role !== 'school_admin') {
    redirect('/dashboard');
  }

  // Fetch all students for this tenant with their latest class enrollment
  const students = await prisma.student.findMany({
    where: { tenantId: tenant.id },
    select: {
      id: true,
      name: true,
      guardianContactInfo: true,
      enrollments: {
        select: {
          classLevel: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
  });

  // Fetch class levels for filtering
  const classLevels = await prisma.classLevel.findMany({
    select: { id: true, name: true, orderIndex: true },
    orderBy: { orderIndex: 'asc' },
  }).catch(() => []);

  // Fetch tenant parent users to check portal activation status
  const parentUsers = await prisma.tenantUser.findMany({
    where: { tenantId: tenant.id, role: 'parent' },
    select: { id: true, username: true, isActive: true },
  }).catch(() => []);

  const parentUserMap = new Map(parentUsers.map((u: any) => [u.username.toLowerCase(), u]));

  // Aggregate parents by phone, email, or normalized name
  const parentMap = new Map<string, {
    id?: string;
    key: string;
    name: string;
    relationship: string;
    phone: string;
    email: string;
    address: string;
    wards: { id: string; name: string; classLevel: string }[];
    hasPortalAccount: boolean;
  }>();

  for (const student of students) {
    const guardian = (student.guardianContactInfo as any) || {};
    const name = guardian.guardianName || guardian.name || 'Unknown Guardian';
    const phone = guardian.guardianPhone || guardian.phone || '';
    const email = guardian.guardianEmail || guardian.email || '';
    const relationship = guardian.relationship || 'Parent / Guardian';
    const address = guardian.address || '';
    const classLevel = student.enrollments[0]?.classLevel?.name || 'Unassigned';

    // Unique aggregation key based on phone or email or name
    const aggKey = (phone || email || name).toLowerCase().trim();

    if (!parentMap.has(aggKey)) {
      const hasAccount = Boolean(
        (email && parentUserMap.has(email.toLowerCase())) ||
        (phone && parentUserMap.has(phone.toLowerCase()))
      );

      parentMap.set(aggKey, {
        key: aggKey,
        name,
        relationship,
        phone,
        email,
        address,
        wards: [],
        hasPortalAccount: hasAccount,
      });
    }

    const parent = parentMap.get(aggKey)!;
    if (!parent.wards.some((w) => w.id === student.id)) {
      parent.wards.push({
        id: student.id,
        name: student.name,
        classLevel,
      });
    }
  }

  // Fetch explicit guardians from database table
  const dbGuardians = await prisma.guardian.findMany({
    where: { tenantId: tenant.id },
    include: {
      students: {
        include: {
          student: {
            include: {
              enrollments: {
                include: { classLevel: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  for (const g of dbGuardians) {
    const contact = (g.contactInfo as any) || {};
    const phone = contact.phone || '';
    const email = contact.email || '';
    const address = contact.address || '';
    const aggKey = (phone || email || g.name).toLowerCase().trim();

    const hasAccount = Boolean(
      (email && parentUserMap.has(email.toLowerCase())) ||
      (phone && parentUserMap.has(phone.toLowerCase()))
    );

    const wards = g.students.map((sg: any) => ({
      id: sg.student.id,
      name: sg.student.name,
      classLevel: sg.student.enrollments[0]?.classLevel?.name || 'Unassigned',
    }));

    if (!parentMap.has(aggKey)) {
      parentMap.set(aggKey, {
        id: g.id,
        key: aggKey,
        name: g.name,
        relationship: g.relationship || 'Parent / Guardian',
        phone,
        email,
        address,
        wards,
        hasPortalAccount: hasAccount,
      });
    } else {
      const existing = parentMap.get(aggKey)!;
      existing.id = g.id;
      for (const w of wards) {
        if (!existing.wards.some((item) => item.id === w.id)) {
          existing.wards.push(w);
        }
      }
    }
  }

  const parents = Array.from(parentMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  const allStudents = students.map((s: any) => ({
    id: s.id,
    name: s.name,
    classLevel: s.enrollments[0]?.classLevel?.name || 'Unassigned',
  }));

  return (
    <ParentsClient
      slug={slug}
      parents={parents}
      classLevels={classLevels}
      totalStudents={students.length}
      allStudents={allStudents}
    />
  );
}
