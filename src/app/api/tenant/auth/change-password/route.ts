import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { verifyPassword, hashPassword } from '@/lib/auth/passwords';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { currentPassword, newPassword } = body;
    let slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    let domain = '';

    // Fallback: extract slug from query parameters
    if (!slug) {
      slug = (req.nextUrl.searchParams.get('slug') || '').trim().toLowerCase();
    }

    // Fallback: detect tenant slug or custom domain from host headers
    if (!slug) {
      const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').split(':')[0].toLowerCase();
      const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'eduorg.ng').split(':')[0].toLowerCase();

      if (host && host !== rootDomain && !host.startsWith('www.')) {
        if (host.endsWith(`.${rootDomain}`)) {
          slug = host.replace(`.${rootDomain}`, '');
        } else if (!host.includes('localhost') && host.includes('.')) {
          domain = host;
        }
      }
    }

    if ((!slug && !domain) || !currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'slug, currentPassword, and newPassword are required' },
        { status: 400 }
      );
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }

    const tenant = slug ? await getTenantContext({ slug }) : await getTenantContext({ domain });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const auth = await getTenantUserFromCookies(tenant.id);
    if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Fetch the full user record (need passwordHash)
    const user = await prisma.tenantUser.findUnique({ where: { id: auth.user.id } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Verify current password
    const isMatch = await verifyPassword(currentPassword, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    // Hash and save new password
    const newHash = await hashPassword(newPassword);
    await prisma.tenantUser.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    console.error('[Change Password Error]', err);
    return NextResponse.json({ error: err.message || 'Failed to update password' }, { status: 500 });
  }
}
