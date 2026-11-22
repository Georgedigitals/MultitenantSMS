import React from 'react';
import { getPublicSiteCmsConfig } from '@/lib/public-site-cms';
import { SuperAdminLoginClient } from './login-client';

export const dynamic = 'force-dynamic';

export default async function SuperAdminLoginPage() {
  const cms = await getPublicSiteCmsConfig();
  return <SuperAdminLoginClient brand={cms.brand} />;
}
