import React from 'react';
import { getPublicSiteCmsConfig } from '@/lib/public-site-cms';
import { SuperAdminForgotPasswordClient } from './forgot-password-client';

export const dynamic = 'force-dynamic';

export default async function SuperAdminForgotPasswordPage() {
  const cms = await getPublicSiteCmsConfig();
  return <SuperAdminForgotPasswordClient brand={cms.brand} />;
}
