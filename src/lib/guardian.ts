import prisma from '@/lib/prisma';

/**
 * Resolves the Guardian record and linked student ward IDs for a logged-in parent user.
 * Supports matching via:
 * 1. Explicit userId saved in guardian.contactInfo
 * 2. Generated or assigned portal username
 * 3. Registered guardian email address
 * 4. Registered guardian phone number
 */
export async function getParentWardsForUser(tenantId: string, user: { id: string; username: string }) {
  const account = await prisma.tenantUser.findFirst({
    where: { id: user.id, tenantId, role: 'parent', isActive: true },
    select: { guardianId: true },
  });

  const guardians = await prisma.guardian.findMany({
    where: { tenantId },
    include: {
      students: {
        include: {
          student: {
            include: {
              enrollments: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                include: { classLevel: true },
              },
            },
          },
        },
      },
    },
  });

  const uLower = user.username.toLowerCase().trim();

  const matched = guardians.find((g: any) => {
    const info = (g.contactInfo as any) || {};
    const email = info.email ? String(info.email).toLowerCase().trim() : null;
    const phone = info.phone ? String(info.phone).trim() : null;
    const username = info.username ? String(info.username).toLowerCase().trim() : null;
    const userId = info.userId ? String(info.userId) : null;

    return (
      (account?.guardianId && g.id === account.guardianId) ||
      userId === user.id ||
      username === uLower ||
      email === uLower ||
      phone === user.username.trim() ||
      (phone && uLower.includes(phone.toLowerCase()))
    );
  });

  if (!matched) {
    return {
      guardian: null,
      studentIds: [] as string[],
      wards: [] as Array<{ id: string; name: string; classLevel: string }>,
    };
  }

  const studentIds = matched.students.map((sg: any) => sg.studentId);
  const wards = matched.students.map((sg: any) => ({
    id: sg.student.id,
    name: sg.student.name,
    classLevel: sg.student.enrollments?.[0]?.classLevel?.name || 'N/A',
  }));

  return {
    guardian: matched,
    studentIds,
    wards,
  };
}
