import prisma from '../src/lib/prisma';
import {
  createNotification,
  createBulkNotifications,
  createSuperAdminBroadcast,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../src/lib/notifications';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runModule11Tests() {
  console.log('====================================================');
  console.log('  Module 11: In-App Notifications Verification');
  console.log('====================================================');

  try {
    // 1. Setup Test Data
    console.log('\n--- Test 1: Setup Test Tenants & Users ---');
    let plan = await prisma.plan.findFirst();
    if (!plan) {
      plan = await prisma.plan.create({
        data: { name: 'Standard Module11', studentCeiling: 200, price: 50.00 },
      });
    }

    const tenantA = await prisma.tenant.create({
      data: {
        name: 'Notification School A',
        slug: `notif-school-a-${Date.now()}`,
        status: 'active',
        planId: plan.id,
      },
    });

    const tenantB = await prisma.tenant.create({
      data: {
        name: 'Notification School B',
        slug: `notif-school-b-${Date.now()}`,
        status: 'active',
        planId: plan.id,
      },
    });

    const adminA = await prisma.tenantUser.create({
      data: {
        tenantId: tenantA.id,
        username: `admin_a_${Date.now()}`,
        passwordHash: 'hashed',
        role: 'school_admin',
      },
    });

    const adminB = await prisma.tenantUser.create({
      data: {
        tenantId: tenantB.id,
        username: `admin_b_${Date.now()}`,
        passwordHash: 'hashed',
        role: 'school_admin',
      },
    });

    assert(Boolean(tenantA.id && tenantB.id), 'Created two isolated test tenants');
    assert(Boolean(adminA.id && adminB.id), 'Created admin users for both tenants');

    // 2. Notification Creation & Feed Retrieval
    console.log('\n--- Test 2: Notification Creation & Feed Retrieval ---');
    const notif1 = await createNotification({
      tenantId: tenantA.id,
      recipientId: adminA.id,
      recipientType: 'school_admin',
      type: 'subject_submitted',
      message: 'Math score entry has been submitted for review.',
      link: `/${tenantA.slug}/dashboard/results`,
    });

    const notif2 = await createNotification({
      tenantId: tenantA.id,
      recipientId: adminA.id,
      recipientType: 'school_admin',
      type: 'fee_payment_recorded',
      message: 'Offline cash payment of ₦25,000 received from John Doe.',
      link: `/${tenantA.slug}/dashboard/fees`,
    });

    assert(Boolean(notif1.id && notif2.id), 'Successfully created single notifications');

    const feedInitial = await getNotifications({
      tenantId: tenantA.id,
      recipientId: adminA.id,
    });

    assert(feedInitial.notifications.length === 2, 'Retrieved 2 notifications for Tenant A admin');
    assert(feedInitial.unreadCount === 2, 'Initial unread count is 2');
    assert(feedInitial.totalCount === 2, 'Total notification count is 2');

    // 3. Read/Unread State Transitions
    console.log('\n--- Test 3: Read/Unread State Transitions ---');
    await markNotificationAsRead(tenantA.id, adminA.id, notif1.id);

    const feedAfterOneRead = await getNotifications({
      tenantId: tenantA.id,
      recipientId: adminA.id,
    });

    assert(feedAfterOneRead.unreadCount === 1, 'Unread count decreased to 1 after marking single notification read');

    const unreadOnlyFeed = await getNotifications({
      tenantId: tenantA.id,
      recipientId: adminA.id,
      unreadOnly: true,
    });
    assert(unreadOnlyFeed.notifications.length === 1, 'Unread-only filter returns exactly 1 item');
    assert(unreadOnlyFeed.notifications[0].id === notif2.id, 'Unread item is notif2');

    await markAllNotificationsAsRead(tenantA.id, adminA.id);
    const feedAllRead = await getNotifications({
      tenantId: tenantA.id,
      recipientId: adminA.id,
    });
    assert(feedAllRead.unreadCount === 0, 'Unread count is 0 after markAllNotificationsAsRead');

    // 4. Super Admin Broadcast Announcement
    console.log('\n--- Test 4: Super Admin Platform Broadcast ---');
    const broadcastResult = await createSuperAdminBroadcast({
      message: 'Scheduled maintenance this Sunday at 2:00 AM UTC.',
      link: '/status',
      targetTenantIds: [tenantA.id, tenantB.id],
    });

    assert(broadcastResult.count >= 2, 'Broadcast successfully dispatched notifications to target tenant admins');

    const feedABroadcast = await getNotifications({
      tenantId: tenantA.id,
      recipientId: adminA.id,
    });

    const hasBroadcastA = feedABroadcast.notifications.some(
      (n: any) => n.type === 'platform_announcement' && n.message.includes('Scheduled maintenance')
    );
    assert(hasBroadcastA, 'Tenant A admin received super admin broadcast notification');

    const feedBBroadcast = await getNotifications({
      tenantId: tenantB.id,
      recipientId: adminB.id,
    });

    const hasBroadcastB = feedBBroadcast.notifications.some(
      (n: any) => n.type === 'platform_announcement' && n.message.includes('Scheduled maintenance')
    );
    assert(hasBroadcastB, 'Tenant B admin received super admin broadcast notification');

    // 5. Multi-Tenant Isolation (§11.1)
    console.log('\n--- Test 5: Multi-Tenant Isolation Guard ---');
    const tenantBFeed = await getNotifications({
      tenantId: tenantB.id,
      recipientId: adminA.id, // Trying to query Admin A under Tenant B context
    });

    assert(tenantBFeed.notifications.length === 0, 'Admin A cannot read notifications under Tenant B scoping');

    // Clean up test data
    console.log('\n--- Cleaning up test records ---');
    await prisma.notification.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await prisma.tenantUser.deleteMany({
      where: { id: { in: [adminA.id, adminB.id] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantA.id, tenantB.id] } },
    });

    console.log('\n====================================================');
    console.log('  ✅ ALL MODULE 11 VERIFICATION TESTS PASSED!');
    console.log('====================================================');
  } catch (error) {
    console.error('\n❌ Module 11 verification failed:', error);
    process.exit(1);
  }
  process.exit(0);
}

runModule11Tests();
