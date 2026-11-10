import { NextRequest, NextResponse } from 'next/server';
import { resolveTxt } from 'node:dns/promises';
import prisma from '@/lib/prisma';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import { tenantHasFeature } from '@/lib/features';

/**
 * POST /api/admin/tenants/domains/verify
 * Body: { aliasId }
 * Completes ownership verification after the tenant owner publishes the TXT
 * record returned by POST /api/admin/tenants/domains.
 */
export async function POST(req: NextRequest) {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const aliasId = (body as { aliasId?: unknown })?.aliasId;
  if (typeof aliasId !== 'string' || !aliasId.trim() || aliasId.length > 100) {
    return NextResponse.json({ error: 'A valid aliasId is required.' }, { status: 400 });
  }

  const alias = await prisma.domainAlias.findUnique({
    where: { id: aliasId.trim() },
    select: { id: true, tenantId: true, domain: true, verificationToken: true, verifiedAt: true },
  });
  if (!alias) return NextResponse.json({ error: 'Domain alias not found.' }, { status: 404 });
  if (!(await tenantHasFeature(alias.tenantId, 'custom_domain'))) {
    return NextResponse.json({ error: 'Custom domains are available on the Enterprise plan.' }, { status: 403 });
  }
  if (alias.verifiedAt) {
    return NextResponse.json({ success: true, verified: true, domain: alias.domain });
  }

  let records: string[][];
  try {
    records = await resolveTxt(`_bms-verification.${alias.domain}`);
  } catch {
    return NextResponse.json({
      error: 'Verification record was not found yet. Add the TXT record and allow DNS time to propagate.',
      verified: false,
    }, { status: 422 });
  }

  const found = records.some((parts) => parts.join('') === alias.verificationToken);
  if (!found) {
    return NextResponse.json({
      error: 'The TXT record does not match the verification value for this domain.',
      verified: false,
    }, { status: 422 });
  }

  const updated = await prisma.domainAlias.updateMany({
    where: { id: alias.id, verificationToken: alias.verificationToken, verifiedAt: null },
    data: { verifiedAt: new Date() },
  });

  return NextResponse.json({
    success: true,
    verified: true,
    domain: alias.domain,
    changed: updated.count > 0,
  });
}
