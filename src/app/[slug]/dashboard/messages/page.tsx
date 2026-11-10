import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant';
import { getTenantUserFromCookies } from '@/lib/auth/tenant-auth';
import { getUserConversations, getEligibleRecipients } from '@/lib/messages';
import MessagesClient from './messages-client';

interface MessagesPageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ recipient?: string; conversation?: string }>;
}

export default async function MessagesPage({ params, searchParams }: MessagesPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const tenant = await getTenantContext({ slug });

  if (!tenant) {
    notFound();
  }

  const auth = await getTenantUserFromCookies(tenant.id);
  if (!auth) {
    redirect('/login');
  }

  // Fetch initial conversations and eligible recipients
  const [conversations, recipients] = await Promise.all([
    getUserConversations(tenant.id, auth.user.id),
    getEligibleRecipients(tenant.id, auth.user),
  ]);

  return (
    <MessagesClient
      slug={slug}
      currentUserId={auth.user.id}
      currentUserRole={auth.user.role}
      initialConversations={conversations}
      recipients={recipients}
      preselectedRecipientId={resolvedSearchParams.recipient || null}
      preselectedConversationId={resolvedSearchParams.conversation || null}
    />
  );
}
