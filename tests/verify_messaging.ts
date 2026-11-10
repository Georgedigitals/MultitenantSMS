import prisma from '../src/lib/prisma';
import {
  canCommunicate,
  getOrCreateDirectConversation,
  postMessage,
  getUserConversations,
  getConversationThread,
  getEligibleRecipients,
} from '../src/lib/messages';
import { TenantUserRole } from '@prisma/client';

async function runMessagingVerification() {
  console.log('=== STARTING IN-APP MESSAGING & SAFEGUARDING VERIFICATION SUITE ===\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // 1. Get or create test tenant
  const tenant = (await prisma.tenant.findFirst({
    where: { slug: 'disaster-sandbox-school' },
  })) || (await prisma.tenant.findFirst());

  if (!tenant) {
    throw new Error('No tenant found in database for messaging verification');
  }

  console.log(`Using test tenant: "${tenant.name}" (${tenant.id})\n`);

  // 2. Prepare / ensure mock users for testing roles
  // Admin user
  let adminUser = await prisma.tenantUser.findFirst({
    where: { tenantId: tenant.id, role: 'school_admin' },
  });
  if (!adminUser) {
    adminUser = await prisma.tenantUser.create({
      data: {
        tenantId: tenant.id,
        username: `test_admin_${Date.now()}`,
        passwordHash: 'dummyhash',
        role: 'school_admin',
      },
    });
  }

  // Teacher user
  let teacherUser = await prisma.tenantUser.findFirst({
    where: { tenantId: tenant.id, role: 'teacher' },
  });
  if (!teacherUser) {
    teacherUser = await prisma.tenantUser.create({
      data: {
        tenantId: tenant.id,
        username: `test_teacher_${Date.now()}`,
        passwordHash: 'dummyhash',
        role: 'teacher',
      },
    });
  }

  // Student 1 user
  let student1User = await prisma.tenantUser.findFirst({
    where: { tenantId: tenant.id, role: 'student' },
  });
  if (!student1User) {
    student1User = await prisma.tenantUser.create({
      data: {
        tenantId: tenant.id,
        username: `test_student1_${Date.now()}`,
        passwordHash: 'dummyhash',
        role: 'student',
      },
    });
  }

  // Student 2 user
  const student2User = await prisma.tenantUser.create({
    data: {
      tenantId: tenant.id,
      username: `test_student2_${Date.now()}`,
      passwordHash: 'dummyhash',
      role: 'student',
    },
  });

  // Parent user
  let parentUser = await prisma.tenantUser.findFirst({
    where: { tenantId: tenant.id, role: 'parent' },
  });
  if (!parentUser) {
    parentUser = await prisma.tenantUser.create({
      data: {
        tenantId: tenant.id,
        username: `test_parent_${Date.now()}`,
        passwordHash: 'dummyhash',
        role: 'parent',
      },
    });
  }

  const createdConversationIds: string[] = [];

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: School Safeguarding Boundaries
    // ─────────────────────────────────────────────────────────────────────────
    console.log('--- Test 1: Safeguarding Boundaries Enforcement ---');

    // Admin -> Teacher
    const check1 = await canCommunicate(
      tenant.id,
      { id: adminUser.id, role: 'school_admin', tenantId: tenant.id, username: adminUser.username, staffId: null, studentId: null },
      teacherUser.id
    );
    assert(check1.allowed, 'Admin can message Teacher');

    // Teacher -> Parent
    const check2 = await canCommunicate(
      tenant.id,
      { id: teacherUser.id, role: 'teacher', tenantId: tenant.id, username: teacherUser.username, staffId: null, studentId: null },
      parentUser.id
    );
    assert(check2.allowed, 'Teacher can message Parent');

    // Student -> Student (MUST BE BLOCKED)
    const check3 = await canCommunicate(
      tenant.id,
      { id: student1User.id, role: 'student', tenantId: tenant.id, username: student1User.username, staffId: null, studentId: null },
      student2User.id
    );
    assert(!check3.allowed, 'Student -> Student chat is strictly blocked by safeguarding policy');

    // Parent -> Parent (MUST BE BLOCKED)
    const anotherParent = await prisma.tenantUser.create({
      data: {
        tenantId: tenant.id,
        username: `test_parent2_${Date.now()}`,
        passwordHash: 'dummyhash',
        role: 'parent',
      },
    });
    const check4 = await canCommunicate(
      tenant.id,
      { id: parentUser.id, role: 'parent', tenantId: tenant.id, username: parentUser.username, staffId: null, studentId: null },
      anotherParent.id
    );
    assert(!check4.allowed, 'Parent -> Parent direct chat is blocked');
    await prisma.tenantUser.delete({ where: { id: anotherParent.id } });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: Direct Conversation Lifecycle & Deduplication
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 2: Thread Creation & Deduplication ---');

    const convId1 = await getOrCreateDirectConversation(tenant.id, adminUser.id, teacherUser.id);
    createdConversationIds.push(convId1);
    assert(Boolean(convId1), `Direct thread created: ${convId1}`);

    const convId2 = await getOrCreateDirectConversation(tenant.id, adminUser.id, teacherUser.id);
    assert(convId1 === convId2, 'Re-querying same participants reuses existing thread without duplicate');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: Message Posting & Unread Counters
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 3: Message Dispatch & Unread Tracking ---');

    const msg1 = await postMessage(
      tenant.id,
      adminUser.id,
      convId1,
      'Hello Teacher, please review the upcoming term syllabus.'
    );
    assert(msg1.content.includes('syllabus'), 'Message posted successfully');
    assert(msg1.isMe === true, 'Sender receives isMe = true');

    // Check conversation summary for teacher (recipient)
    const teacherConversations = await getUserConversations(tenant.id, teacherUser.id);
    const targetConv = teacherConversations.find((c) => c.id === convId1);
    assert(Boolean(targetConv), 'Recipient sees conversation in list');
    assert(targetConv?.unreadCount === 1, 'Recipient has exactly 1 unread message');
    assert(targetConv?.lastMessage?.content === msg1.content, 'Last message snippet matches latest post');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: Thread Retrieval & Automatic Mark As Read
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 4: Thread Reading & Read Receipt Clearance ---');

    const thread = await getConversationThread(tenant.id, convId1, teacherUser.id);
    assert(thread.messages.length >= 1, 'Thread retrieved messages');
    const lastThreadMsg = thread.messages[thread.messages.length - 1];
    assert(lastThreadMsg.content === msg1.content, 'Thread message content matches');
    assert(lastThreadMsg.isMe === false, 'Recipient sees isMe = false for incoming message');

    // After thread fetch, recipient's unread counter should now be 0
    const teacherConversationsAfterRead = await getUserConversations(tenant.id, teacherUser.id);
    const targetConvAfterRead = teacherConversationsAfterRead.find((c) => c.id === convId1);
    assert(targetConvAfterRead?.unreadCount === 0, 'Unread count automatically cleared upon viewing thread');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5: Recipient Querying Filter
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 5: Recipient Options Querying ---');

    const recipients = await getEligibleRecipients(tenant.id, {
      id: adminUser.id,
      role: 'school_admin',
      tenantId: tenant.id,
      username: adminUser.username,
      staffId: null,
      studentId: null,
    });
    assert(recipients.length > 0, 'Admin can retrieve contacts across roles');
    assert(recipients.some((r) => r.id === teacherUser.id), 'Teacher is present in admin recipients');
  } finally {
    // Clean up created records
    console.log('\n--- Cleaning up test artifacts ---');
    for (const cid of createdConversationIds) {
      await prisma.conversation.delete({ where: { id: cid } }).catch(() => {});
    }
    await prisma.tenantUser.delete({ where: { id: student2User.id } }).catch(() => {});
  }

  console.log(`\n=== ALL ${passed}/${total} IN-APP MESSAGING TESTS PASSED SUCCESSFULLY! ===`);
  process.exit(0);
}

runMessagingVerification()
  .catch((e) => {
    console.error('Verification failed:', e);
    process.exit(1);
  });

