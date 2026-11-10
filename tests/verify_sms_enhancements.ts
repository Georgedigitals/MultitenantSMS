import { prisma } from '../src/lib/prisma';
import {
  formatNigerianPhoneNumber,
  extractParentPhone,
  sendResultPublishedAlert,
  sendPinPurchaseSms,
  dispatchAutoFeeAlert,
  dispatchAutoAbsentAlerts,
} from '../src/lib/sms-service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ PASS  ${message}`);
}

async function runSmsEnhancementTests() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  SMS Master Integration & Torchlight Parent Helpline Tests');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Test 1: Nigerian Phone Number Formatting
  console.log('Test 1: Nigerian phone number E.164 normalization');
  assert(formatNigerianPhoneNumber('08031234567') === '2348031234567', 'Normalizes 11-digit 080... to 23480...');
  assert(formatNigerianPhoneNumber('+234 803 123 4567') === '2348031234567', 'Strips whitespace and +');
  assert(formatNigerianPhoneNumber('07011122233') === '2347011122233', 'Normalizes 070... to 23470...');

  // Test 2: Extract Parent Phone
  console.log('\nTest 2: Extract parent phone from guardian JSON / relations');
  const parent1 = extractParentPhone({ guardianPhone: '08022223344', parentName: 'Alhaji Musa' });
  assert(parent1.phone === '08022223344', 'Extracts candidate phone from guardianContactInfo');
  assert(parent1.name === 'Alhaji Musa', 'Extracts candidate name');

  // Test 3: Graceful Skip when SMS feature/credentials are absent (No Crash)
  console.log('\nTest 3: Graceful non-blocking degradation when SMS is inactive');
  const apex = await prisma.tenant.findUnique({
    where: { slug: 'apex' },
    include: { students: true, sessions: { include: { terms: true } } },
  });

  if (!apex) throw new Error('Apex tenant missing');

  // Call dispatchAutoFeeAlert - should complete gracefully with zero exceptions even with mock/no credentials
  let feeAlertThrew = false;
  try {
    if (apex.students[0] && apex.sessions[0]?.terms[0]) {
      await dispatchAutoFeeAlert({
        tenantId: apex.id,
        studentId: apex.students[0].id,
        termId: apex.sessions[0].terms[0].id,
        amountPaid: 25000,
        paymentRef: 'TEST-REF-001',
      });
    }
  } catch {
    feeAlertThrew = true;
  }
  assert(!feeAlertThrew, 'dispatchAutoFeeAlert completes cleanly without breaking transaction');

  // Call dispatchAutoAbsentAlerts - should also complete gracefully
  let absentAlertThrew = false;
  try {
    if (apex.students[0]) {
      await dispatchAutoAbsentAlerts({
        tenantId: apex.id,
        date: new Date(),
        absentStudentIds: [apex.students[0].id],
      });
    }
  } catch {
    absentAlertThrew = true;
  }
  assert(!absentAlertThrew, 'dispatchAutoAbsentAlerts completes cleanly without throwing');

  // Test 4: School Inquiries Phone Embedding in Result SMS
  console.log('\nTest 4: School Inquiries Helpline embedding in Result SMS');
  // Temporarily update apex branding with an inquiries phone
  const existingBranding = (apex.branding as any) || {};
  await prisma.tenant.update({
    where: { id: apex.id },
    data: {
      branding: {
        ...existingBranding,
        inquiriesPhone: '08039998877',
      },
    },
  });

  // Call sendResultPublishedAlert with mock config or catch
  const resResult = await sendResultPublishedAlert({
    tenantId: apex.id,
    studentName: 'Chinedu Okeke',
    guardianName: 'Chief Okeke',
    parentPhone: '08031234567',
    schoolName: apex.name,
    termName: 'First Term',
    averageScore: 88.5,
    position: 2,
    classSize: 35,
    checkUrl: `/${apex.slug}/results/check`,
  });

  // Check the recorded SMS log to verify that the message contains the inquiries helpline!
  const latestLog = await prisma.smsLog.findFirst({
    where: { tenantId: apex.id, phone: '2348031234567' },
    orderBy: { sentAt: 'desc' },
  });

  assert(!!latestLog, 'SMS log recorded in database');
  if (latestLog) {
    assert(
      latestLog.message.includes('Call: 08039998877'),
      `Message includes touchlight-dialable helpline: "${latestLog.message}"`
    );
  }

  // Restore branding
  await prisma.tenant.update({
    where: { id: apex.id },
    data: { branding: existingBranding },
  });

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  All SMS Master & Graceful Fallback Tests Passed! (4/4)');
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

runSmsEnhancementTests()
  .catch((err) => {
    console.error('Fatal error in SMS enhancement tests:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

