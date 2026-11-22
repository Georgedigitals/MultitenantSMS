import React from 'react';
import { getPublicSiteCmsConfig } from '@/lib/public-site-cms';
import { SuperAdminResetPasswordClient } from './reset-password-client';

export const dynamic = 'force-dynamic';

export default async function SuperAdminResetPasswordPage() {
  const cms = await getPublicSiteCmsConfig();
  return <SuperAdminResetPasswordClient brand={cms.brand} />;
}
