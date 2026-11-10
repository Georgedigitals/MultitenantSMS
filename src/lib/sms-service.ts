import prisma from './prisma';
import { tenantHasFeature } from './features';

export interface SendSmsParams {
  tenantId: string;
  phone: string;
  message: string;
  senderId?: string;
}

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  provider: string;
  phone: string;
  status: 'sent' | 'failed';
  error?: string;
}

/**
 * Normalizes phone numbers to standard international E.164 format for Nigerian gateways (e.g. 2348012345678)
 */
export function formatNigerianPhoneNumber(rawPhone: string): string {
  if (!rawPhone) return '';
  // Strip non-digits
  let clean = rawPhone.replace(/\D/g, '');

  // Local Nigerian format starting with 0 (e.g. 08031234567 -> 2348031234567)
  if (clean.startsWith('0') && clean.length === 11) {
    clean = '234' + clean.slice(1);
  } else if (clean.length === 10) {
    clean = '234' + clean;
  }
  return clean;
}

/**
 * Core SMS dispatcher using Tenant's configured SMS Gateway (Termii / Twilio)
 */
export async function sendSms(params: SendSmsParams): Promise<SmsSendResult> {
  const { tenantId, phone, message } = params;
  const formattedPhone = formatNigerianPhoneNumber(phone);

  if (!(await tenantHasFeature(tenantId, 'feature_sms_alerts'))) {
    return { success: false, provider: 'disabled', phone, status: 'failed', error: 'SMS alerts are not enabled for this school.' };
  }

  if (!formattedPhone || formattedPhone.length < 10) {
    return {
      success: false,
      provider: 'unknown',
      phone,
      status: 'failed',
      error: 'Invalid recipient phone number',
    };
  }

  // 1. Fetch Tenant SMS Gateway configuration
  const config = await prisma.smsConfiguration.findUnique({
    where: { tenantId },
  });

  const provider = config?.provider || 'termii';
  const apiKey = config?.apiKey || process.env.TERMII_API_KEY || null;
  const senderId = params.senderId || config?.senderId || 'SchoolBMS';

  let sendStatus: 'sent' | 'failed' = 'sent';
  let errorMsg: string | undefined = undefined;
  let messageId: string | undefined = undefined;

  // 2. Dispatch via Termii Gateway (Default for Nigerian School Operations)
  if (provider === 'termii' && apiKey && !apiKey.startsWith('mock_')) {
    try {
      const callTermii = async (fromId: string, channel: string) => {
        const response = await fetch('https://api.ng.termii.com/api/sms/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: formattedPhone,
            from: fromId.substring(0, 11),
            sms: message,
            type: 'plain',
            channel,
            api_key: apiKey,
          }),
        });
        const data = await response.json().catch(() => ({}));
        return { response, data };
      };

      // Attempt 1: Priority DND route with configured sender ID (delivers to all Nigerian lines)
      let { response, data } = await callTermii(senderId, 'dnd');

      // Attempt 2: If sender ID is unapproved / does not exist on Termii, fallback to default registered 'N-Alert'
      const dataMsg = String(data?.message || '').toLowerCase();
      if (!response.ok && (dataMsg.includes('sender') || response.status === 400)) {
        console.warn(`[Termii] Sender ID "${senderId}" rejected (${data?.message}), retrying with default N-Alert...`);
        const fallback = await callTermii('N-Alert', 'dnd');
        if (fallback.response.ok || fallback.data?.message_id || fallback.data?.code === 'ok') {
          response = fallback.response;
          data = fallback.data;
        } else {
          // Attempt 3: Try generic channel as last resort
          const genericAttempt = await callTermii(senderId, 'generic');
          if (genericAttempt.response.ok || genericAttempt.data?.message_id) {
            response = genericAttempt.response;
            data = genericAttempt.data;
          }
        }
      }

      console.log(`[Termii Response] Status: ${response.status}`, data);

      if (response.ok && (data.message_id || data.code === 'ok' || data.message === 'Successfully Sent')) {
        messageId = data.message_id || `TRM_${Date.now()}`;
        sendStatus = 'sent';
      } else {
        errorMsg = data.message || `Termii error HTTP ${response.status}`;
        sendStatus = 'failed';
      }
    } catch (err: any) {
      console.error('[Termii Network Error]', err);
      errorMsg = err.message || 'Termii network connection error';
      sendStatus = 'failed';
    }
  } else if (provider === 'twilio') {
    // Parse Account SID and Auth Token
    // Support formats: "ACxxx:auth_token", "ACxxx, auth_token", "ACxxx|auth_token", or space/newline
    let accountSid: string | null = null;
    let authToken: string | null = null;

    if (apiKey) {
      const parts = apiKey.split(/[:|, \r\n]+/).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        accountSid = parts[0];
        authToken = parts[1];
      } else if (parts.length === 1 && parts[0].startsWith('AC')) {
        accountSid = parts[0];
      }
    }

    if (!accountSid && process.env.TWILIO_ACCOUNT_SID) {
      accountSid = process.env.TWILIO_ACCOUNT_SID.trim();
    }
    if (!authToken && process.env.TWILIO_AUTH_TOKEN) {
      authToken = process.env.TWILIO_AUTH_TOKEN.trim();
    }

    const fromNumber = params.senderId || config?.senderId || process.env.TWILIO_FROM_NUMBER || 'SchoolBMS';

    if (!accountSid || !authToken) {
      errorMsg = 'SMS delivery is unavailable because Twilio credentials (Account SID and Auth Token) are not configured.';
      sendStatus = 'failed';
    } else {
      try {
        const bodyParams = new URLSearchParams({
          To: `+${formattedPhone}`,
          From: fromNumber,
          Body: message,
        });
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: bodyParams.toString(),
          }
        );
        const data = await response.json().catch(() => ({}));
        if (response.ok && data?.sid) {
          messageId = data.sid;
          sendStatus = 'sent';
        } else {
          errorMsg = data?.message || (data?.code ? `Twilio error ${data.code}: ${data.message || 'Dispatch failed'}` : `Twilio error HTTP ${response.status}`);
          sendStatus = 'failed';
        }
      } catch (err: any) {
        errorMsg = err?.message || 'Twilio network connection error';
        sendStatus = 'failed';
      }
    }
  } else {
    errorMsg = `SMS delivery is unavailable because ${provider} credentials are not configured.`;
    sendStatus = 'failed';
  }

  // 3. Record Audit Log in sms_logs table
  const logStatus = sendStatus === 'sent' ? 'sent' : (errorMsg ? `failed: ${errorMsg}` : 'failed');
  try {
    await prisma.smsLog.create({
      data: {
        tenantId,
        phone: formattedPhone,
        message,
        status: logStatus,
      },
    });
  } catch (logErr) {
    console.error('[SMS Log Error]', logErr);
  }

  return {
    success: sendStatus === 'sent',
    messageId,
    provider,
    phone: formattedPhone,
    status: sendStatus,
    error: errorMsg,
  };
}

/**
 * Resolves guardian parent phone and name by inspecting both student.guardianContactInfo
 * and student.guardians relation. Handles varying key conventions (phone, phoneNumber, guardianPhone, mobile, etc.).
 */
export function extractParentPhone(
  guardianContactInfo: any,
  guardians?: Array<{ guardian: { name?: string | null; contactInfo?: any } }>
): { phone: string | null; name: string | null } {
  const gci = (typeof guardianContactInfo === 'object' && guardianContactInfo !== null)
    ? guardianContactInfo
    : {};

  const candidatePhone =
    gci.guardianPhone ||
    gci.phone ||
    gci.phoneNumber ||
    gci.mobile ||
    gci.guardian_phone ||
    gci.emergencyContact ||
    gci.telephone;

  const candidateName = gci.guardianName || gci.parentName || gci.name || null;

  if (candidatePhone && String(candidatePhone).trim()) {
    return {
      phone: String(candidatePhone).trim(),
      name: candidateName ? String(candidateName).trim() : null,
    };
  }

  if (guardians && guardians.length > 0) {
    for (const item of guardians) {
      const info = (typeof item.guardian?.contactInfo === 'object' && item.guardian?.contactInfo !== null)
        ? (item.guardian.contactInfo as Record<string, any>)
        : {};
      const gPhone =
        info.guardianPhone ||
        info.phone ||
        info.phoneNumber ||
        info.mobile ||
        info.guardian_phone ||
        info.telephone;
      if (gPhone && String(gPhone).trim()) {
        return {
          phone: String(gPhone).trim(),
          name: item.guardian.name || info.name || null,
        };
      }
    }
  }

  return { phone: null, name: null };
}

/**
 * Sends automated SMS alert to parents when term results are published
 * Matches individual student's dynamic average and class rank to their parents' phone number
 */
export async function sendResultPublishedAlert(options: {
  tenantId: string;
  studentName: string;
  guardianName?: string | null;
  parentPhone: string;
  schoolName: string;
  termName: string;
  averageScore: number;
  position: number | null;
  classSize: number;
  checkUrl: string;
  schoolPhone?: string | null;
}): Promise<SmsSendResult | null> {
  const {
    tenantId,
    studentName,
    guardianName,
    parentPhone,
    schoolName,
    termName,
    averageScore,
    position,
    classSize,
    checkUrl,
  } = options;

  if (!parentPhone) return null;

  let schoolPhone = options.schoolPhone;
  if (!schoolPhone) {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { branding: true },
      });
      const b = (tenant?.branding as any) || {};
      schoolPhone = b.inquiriesPhone || b.phone || b.contactPhone || b.bursarPhone || null;
    } catch {}
  }

  const parentGreeting = guardianName ? `Dear ${guardianName}` : 'Dear Parent';
  const posText = position && classSize ? ` Pos: ${position}/${classSize}.` : (position ? ` Pos: ${position}.` : '');
  const phonePart = schoolPhone ? ` Call: ${schoolPhone}` : '';
  const message = `${parentGreeting}, ${termName} result for ${studentName} at ${schoolName} is out! Avg: ${averageScore}%.${posText} Check online: ${checkUrl}.${phonePart}`;

  return await sendSms({
    tenantId,
    phone: parentPhone,
    message,
  });
}

/**
 * Sends 12-digit PIN code to parent's phone upon online purchase or bursary generation
 */
export async function sendPinPurchaseSms(options: {
  tenantId: string;
  studentName: string;
  parentPhone: string;
  schoolName: string;
  termName: string;
  pinCode: string;
  checkUrl: string;
  schoolPhone?: string | null;
}): Promise<SmsSendResult | null> {
  const { tenantId, studentName, parentPhone, schoolName, termName, pinCode, checkUrl } = options;

  if (!parentPhone) return null;

  let schoolPhone = options.schoolPhone;
  if (!schoolPhone) {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { branding: true },
      });
      const b = (tenant?.branding as any) || {};
      schoolPhone = b.inquiriesPhone || b.phone || b.contactPhone || b.bursarPhone || null;
    } catch {}
  }

  const phonePart = schoolPhone ? ` Help: ${schoolPhone}` : '';
  const message = `${schoolName}: Your Result Checker PIN for ${studentName} (${termName}) is ${pinCode}. Check: ${checkUrl}.${phonePart}`;

  return await sendSms({
    tenantId,
    phone: parentPhone,
    message,
  });
}

/**
 * Automatically sends an SMS payment receipt to a student's parent/guardian when autoFeeAlert is enabled.
 */
export async function dispatchAutoFeeAlert(options: {
  tenantId: string;
  studentId: string;
  termId: string;
  amountPaid: number;
  paymentRef?: string | null;
}): Promise<void> {
  try {
    const { tenantId, studentId, termId, amountPaid, paymentRef } = options;
    const smsConfig = await prisma.smsConfiguration.findUnique({ where: { tenantId } });
    if (!smsConfig || smsConfig.autoFeeAlert === false) return;

    const [tenant, student, term] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, branding: true } }),
      prisma.student.findFirst({
        where: { id: studentId, tenantId },
        select: {
          name: true,
          guardianContactInfo: true,
          guardians: { include: { guardian: { select: { name: true, contactInfo: true } } } },
        },
      }),
      prisma.term.findFirst({
        where: { id: termId, session: { tenantId } },
        select: { name: true },
      }),
    ]);

    if (!tenant || !student) return;

    const { phone: parentPhone, name: guardianName } = extractParentPhone(
      student.guardianContactInfo,
      student.guardians
    );
    if (!parentPhone) return;

    const b = (tenant.branding as any) || {};
    const schoolPhone = b.inquiriesPhone || b.phone || b.contactPhone || b.bursarPhone || null;
    const phonePart = schoolPhone ? ` Enquiries: ${schoolPhone}` : '';

    const greeting = guardianName ? `Dear ${guardianName}` : 'Dear Parent';
    const termLabel = term?.name || 'Current Term';
    const refPart = paymentRef ? ` (Ref: ${paymentRef})` : '';
    const message = `${greeting}, ${tenant.name} received school fee payment of ₦${Number(amountPaid).toLocaleString()} for ${student.name} - ${termLabel}${refPart}.${phonePart} Thank you!`;

    await sendSms({
      tenantId,
      phone: parentPhone,
      message,
    });
  } catch (err) {
    console.warn('[Auto Fee SMS Alert Error]', err);
  }
}

/**
 * Automatically sends an SMS absence alert to parents of students newly marked absent when autoAbsentAlert is enabled.
 */
export async function dispatchAutoAbsentAlerts(options: {
  tenantId: string;
  date: Date;
  absentStudentIds: string[];
}): Promise<void> {
  try {
    const { tenantId, date, absentStudentIds } = options;
    if (absentStudentIds.length === 0) return;

    const smsConfig = await prisma.smsConfiguration.findUnique({ where: { tenantId } });
    if (!smsConfig || !smsConfig.autoAbsentAlert) return;

    const [tenant, students] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, branding: true } }),
      prisma.student.findMany({
        where: { id: { in: absentStudentIds }, tenantId },
        select: {
          id: true,
          name: true,
          guardianContactInfo: true,
          guardians: { include: { guardian: { select: { name: true, contactInfo: true } } } },
        },
      }),
    ]);

    if (!tenant || students.length === 0) return;
    const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    const b = (tenant.branding as any) || {};
    const schoolPhone = b.inquiriesPhone || b.phone || b.contactPhone || b.bursarPhone || null;
    const phoneNotice = schoolPhone ? ` Call school: ${schoolPhone}` : ' Please contact the school office if this is unexpected.';

    for (const student of students) {
      const { phone: parentPhone, name: guardianName } = extractParentPhone(
        student.guardianContactInfo,
        student.guardians
      );
      if (!parentPhone) continue;

      const greeting = guardianName ? `Dear ${guardianName}` : 'Dear Parent';
      const message = `${tenant.name} Attendance Alert: ${greeting}, ${student.name} was marked absent today (${dateStr}).${phoneNotice}`;
      await sendSms({
        tenantId,
        phone: parentPhone,
        message,
      });
    }
  } catch (err) {
    console.warn('[Auto Absent SMS Alert Error]', err);
  }
}
