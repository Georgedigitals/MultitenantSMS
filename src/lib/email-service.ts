import nodemailer, { type Transporter } from 'nodemailer';
import prisma from './prisma';
import { getTenantUrl } from './tenant-url';

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  tenantId?: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

// In-memory cache for Nodemailer transporters (platform and verified tenants)
const transporterCache = new Map<string, Transporter>();

function getPlatformSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!host || !user || !pass) {
    return null;
  }

  return { host, port, secure, user, pass };
}

function getOrCreateTransporter(cacheKey: string, config: SmtpConfig): Transporter {
  const cleanPass = config.pass.replace(/\s+/g, '');
  const fullCacheKey = `${cacheKey}_${config.host}_${config.port}_${config.user}_${cleanPass}`;
  const existing = transporterCache.get(fullCacheKey);
  if (existing) {
    return existing;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: cleanPass,
    },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
  });

  transporterCache.set(fullCacheKey, transporter);
  return transporter;
}

/**
 * Validates connectivity with an SMTP server.
 * Used during custom SMTP setup in School Admin settings.
 */
export async function verifySmtpConnection(config: SmtpConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanPass = (config.pass || '').replace(/\s+/g, '');
    const tempTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: cleanPass,
      },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000,
    });

    await tempTransporter.verify();
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to authenticate with SMTP server. Verify host, port, username and password.',
    };
  }
}

/**
 * Universal SMTP email dispatcher.
 * - If tenant has active Custom SMTP, dispatches via tenant's private mail server.
 * - Otherwise, dispatches via platform SMTP with tenant display name + reply-to.
 * - If no live SMTP credentials are configured, logs formatted simulation to console without failing.
 */
export async function dispatchEmail(options: SendEmailOptions): Promise<{ success: boolean; id: string; simulated?: boolean }> {
  const { to, subject, html, fromName, fromEmail, replyTo, tenantId } = options;

  let customSmtp: any = null;
  if (tenantId) {
    try {
      customSmtp = await prisma.emailConfiguration.findUnique({
        where: { tenantId },
      });
    } catch (e) {
      console.warn('[email-service] Failed to query emailConfiguration:', e);
    }
  }

  // 1. Check if tenant has verified custom SMTP
  if (customSmtp && customSmtp.verified && customSmtp.host && customSmtp.user) {
    const tenantConfig: SmtpConfig = {
      host: customSmtp.host,
      port: customSmtp.port,
      secure: customSmtp.secure,
      user: customSmtp.user,
      pass: customSmtp.pass.replace(/\s+/g, ''),
    };

    const senderDisplay = fromName || customSmtp.fromName || 'School Portal';
    const senderEmail = customSmtp.fromEmail || customSmtp.user;
    const formattedFrom = `"${senderDisplay}" <${senderEmail}>`;
    const finalReplyTo = replyTo || customSmtp.replyTo || senderEmail;

    try {
      const transporter = getOrCreateTransporter(`tenant_${tenantId}`, tenantConfig);
      const info = await transporter.sendMail({
        from: formattedFrom,
        to,
        replyTo: finalReplyTo,
        subject,
        html,
      });

      console.log(`[TENANT CUSTOM SMTP SENT] Tenant: ${tenantId} | MsgID: ${info.messageId}`);
      return { success: true, id: info.messageId, simulated: false };
    } catch (err: any) {
      console.error(`[TENANT CUSTOM SMTP FAILED] Falling back to platform default:`, err?.message || err);
    }
  }

  // 2. Platform SMTP Dispatch
  const platformConfig = getPlatformSmtpConfig();
  const defaultPlatformFrom = process.env.SMTP_FROM || 'EduSaaS OS <notifications@edusaas.com>';
  const platformSenderAddress = defaultPlatformFrom.includes('<')
    ? defaultPlatformFrom.match(/<([^>]+)>/)?.[1] || defaultPlatformFrom
    : defaultPlatformFrom;

  // Resolve tenant-specific display name & direct reply-to address
  let resolvedSenderDisplay = fromName || customSmtp?.fromName;
  let resolvedReplyTo = replyTo || customSmtp?.replyTo || fromEmail;

  if (tenantId && (!resolvedSenderDisplay || !resolvedReplyTo)) {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          name: true,
          staff: {
            where: { roleBase: 'admin' },
            select: { contactInfo: true },
            take: 1,
          },
        },
      });
      if (!resolvedSenderDisplay && tenant?.name) {
        resolvedSenderDisplay = tenant.name;
      }
      if (!resolvedReplyTo && tenant?.staff?.[0]?.contactInfo) {
        const cEmail = (tenant.staff[0].contactInfo as any)?.email;
        if (cEmail && typeof cEmail === 'string' && cEmail.includes('@')) {
          resolvedReplyTo = cEmail.trim();
        }
      }
    } catch {
      // Fallback silently
    }
  }

  const senderDisplay = resolvedSenderDisplay || 'EduSaaS OS';
  const formattedFrom = `"${senderDisplay}" <${platformSenderAddress}>`;
  const finalReplyTo = resolvedReplyTo || platformSenderAddress;

  if (platformConfig) {
    try {
      const transporter = getOrCreateTransporter('platform', platformConfig);
      const info = await transporter.sendMail({
        from: formattedFrom,
        to,
        replyTo: finalReplyTo,
        subject,
        html,
      });

      console.log(`[PLATFORM SMTP SENT] MsgID: ${info.messageId}`);
      return { success: true, id: info.messageId, simulated: false };
    } catch (err: any) {
      console.error(`[PLATFORM SMTP FAILED] Error:`, err?.message || err);
      if (process.env.NODE_ENV === 'production') {
        throw err;
      }
      console.warn('[email-service] Falling back to dev simulation because SMTP dispatch failed. Check SMTP credentials in .env.');
    }
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Email delivery is unavailable because platform SMTP is not configured.');
  }

  // 3. Development / Test Simulation Fallback (when .env SMTP is not yet populated)
  const simulatedId = `msg_sim_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  console.log(`[EMAIL DISPATCH - DEV SIMULATION]
  --------------------------------------------------
  To:       [redacted]
  From:     ${formattedFrom}
  Reply-To: ${finalReplyTo}
  Subject:  ${subject}
  Message:  (HTML Payload size: ${html.length} chars)
  ID:       ${simulatedId}
  --------------------------------------------------`);

  return {
    success: true,
    id: simulatedId,
    simulated: true,
  };
}

/**
 * 1. PLATFORM WELCOME NOTIFICATION EMAIL (Platform -> Tenant Admin)
 * Sent upon new school registration from EduSaaS OS.
 * Uses Platform Branding (#0F172A theme, EduSaaS OS Logo).
 */
export async function sendPlatformWelcomeEmail(options: {
  tenantName: string;
  slug: string;
  adminName: string;
  adminEmail: string;
}): Promise<{ success: boolean }> {
  const { tenantName, slug, adminName, adminEmail } = options;
  const portalUrl = getTenantUrl(slug, '/login');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; margin: 0; padding: 24px; color: #f8fafc; }
          .card { max-width: 600px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
          .header { background: linear-gradient(135deg, #1e3a8a, #2563eb); padding: 32px; text-align: center; }
          .header h1 { margin: 0; color: #ffffff; font-size: 24px; font-weight: 900; tracking-tight: -0.025em; }
          .header p { margin: 6px 0 0 0; color: #93c5fd; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }
          .body { padding: 32px; }
          .welcome { font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
          .text { font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px; }
          .box { background-color: #020617; border: 1px solid #1e293b; border-radius: 16px; padding: 20px; margin-bottom: 24px; }
          .box-item { font-size: 13px; color: #cbd5e1; margin-bottom: 8px; font-family: monospace; }
          .box-item strong { color: #60a5fa; }
          .btn { display: inline-block; background: linear-gradient(90deg, #2563eb, #4f46e5); color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 14px; text-align: center; box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3); }
          .footer { padding: 24px 32px; background-color: #020617; border-top: 1px solid #1e293b; text-align: center; font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1>EduSaaS OS Platform</h1>
            <p>Institutional Onboarding Confirmation</p>
          </div>
          <div class="body">
            <div class="welcome">Welcome to EduSaaS OS, ${adminName}! </div>
            <div class="text">
              Your school instance <strong>${tenantName}</strong> has been successfully provisioned on our multi-tenant cloud platform. You can now access your administrative portal, onboard staff, and configure student result checkers.
            </div>
            
            <div class="box">
              <div class="box-item"><strong>School Instance:</strong> ${tenantName}</div>
              <div class="box-item"><strong>Dedicated Portal URL:</strong> ${portalUrl}</div>
              <div class="box-item"><strong>Admin Username:</strong> ${adminEmail}</div>
            </div>

            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${portalUrl}" class="btn">Launch School Portal Gateway →</a>
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} EduSaaS OS Platform. Commercial-Grade Multi-Tenant School Architecture.
          </div>
        </div>
      </body>
    </html>
  `;

  await dispatchEmail({
    to: adminEmail,
    subject: `Welcome to EduSaaS OS — ${tenantName} Portal Ready`,
    html,
    fromName: 'EduSaaS OS Platform',
  });

  return { success: true };
}

/**
 * 2. TENANT-BRANDED PASSWORD RESET & NOTIFICATION EMAIL (Tenant -> Users: Staff, Parents, Students)
 * Dynamically styled using THE TENANT'S OWN BRANDING (logoUrl, primaryColor, accentColor, name).
 */
export async function sendTenantBrandedPasswordResetEmail(options: {
  tenantId: string;
  recipientEmail: string;
  recipientName: string;
  resetToken: string;
  customDomainHost?: string;
}): Promise<{ success: boolean }> {
  const { tenantId, recipientEmail, recipientName, resetToken, customDomainHost } = options;

  // 1. Fetch Tenant Custom Branding
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, slug: true, branding: true },
  });

  if (!tenant) {
    throw new Error('Tenant not found for branded email dispatch');
  }

  const branding = (tenant.branding as any) || {};
  const primaryColor = branding.primaryColor || '#1E3A8A';
  const accentColor = branding.accentColor || '#2563EB';
  const logoUrl = branding.logoUrl || null;
  const schoolName = tenant.name;

  const host = customDomainHost || 'localhost:3000';
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
  const protocol = process.env.NODE_ENV === 'production' && !isLocal ? 'https' : 'http';
  const resetPath = host.startsWith(`${tenant.slug}.`) ? '/reset-password' : `/${tenant.slug}/reset-password`;
  const resetUrl = `${protocol}://${host}${resetPath}?token=${resetToken}&email=${encodeURIComponent(recipientEmail)}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
          .card { max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
          .header { background-color: ${primaryColor}; padding: 32px; text-align: center; }
          .header img { max-height: 60px; margin-bottom: 12px; }
          .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; }
          .body { padding: 32px; }
          .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
          .text { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
          .btn { display: inline-block; background-color: ${accentColor}; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 14px; text-align: center; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }
          .footer { padding: 24px 32px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            ${logoUrl ? `<img src="${logoUrl}" alt="${schoolName} Logo">` : ''}
            <h1>${schoolName}</h1>
          </div>
          <div class="body">
            <div class="greeting">Hello, ${recipientName}</div>
            <div class="text">
              We received a request to reset your password for your account at <strong>${schoolName}</strong>. Click the button below to choose a new password. This link will expire in 60 minutes.
            </div>

            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${resetUrl}" class="btn">Reset Password →</a>
            </div>

            <div class="text" style="font-size: 12px; color: #94a3b8;">
              If you did not request a password reset, you can safely ignore this email.
            </div>
          </div>
          <div class="footer">
            Sent by <strong>${schoolName}</strong> Portal • Powered by EduSaaS OS
          </div>
        </div>
      </body>
    </html>
  `;

  await dispatchEmail({
    to: recipientEmail,
    subject: `Password Reset Request — ${schoolName}`,
    html,
    fromName: schoolName,
    tenantId,
  });

  return { success: true };
}

/**
 * 3. TENANT-BRANDED GENERAL NOTIFICATION DISPATCHER (Tenant -> Users)
 * Sent for Result Alerts, Fee Receipts, Attendance Alerts, and Welcome Messages.
 * Dynamically styled using THE TENANT'S OWN BRANDING.
 */
export async function sendTenantBrandedNotification(options: {
  tenantId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  messageText: string;
  actionUrl?: string;
  actionText?: string;
}): Promise<{ success: boolean }> {
  const { tenantId, recipientEmail, recipientName, subject, messageText, actionUrl, actionText } = options;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, slug: true, branding: true },
  });

  if (!tenant) throw new Error('Tenant not found');

  const branding = (tenant.branding as any) || {};
  const primaryColor = branding.primaryColor || '#1E3A8A';
  const accentColor = branding.accentColor || '#2563EB';
  const logoUrl = branding.logoUrl || null;
  const schoolName = tenant.name;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
          .card { max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
          .header { background-color: ${primaryColor}; padding: 32px; text-align: center; }
          .header img { max-height: 60px; margin-bottom: 12px; }
          .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; }
          .body { padding: 32px; }
          .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
          .text { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
          .btn { display: inline-block; background-color: ${accentColor}; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 14px; text-align: center; }
          .footer { padding: 24px 32px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            ${logoUrl ? `<img src="${logoUrl}" alt="${schoolName} Logo">` : ''}
            <h1>${schoolName}</h1>
          </div>
          <div class="body">
            <div class="greeting">Dear ${recipientName},</div>
            <div class="text">${messageText}</div>

            ${actionUrl ? `
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${actionUrl}" class="btn">${actionText || 'Access Portal →'}</a>
              </div>
            ` : ''}
          </div>
          <div class="footer">
            Official Notification from <strong>${schoolName}</strong> • Powered by EduSaaS OS
          </div>
        </div>
      </body>
    </html>
  `;

  await dispatchEmail({
    to: recipientEmail,
    subject: `${subject} — ${schoolName}`,
    html,
    fromName: schoolName,
    tenantId,
  });

  return { success: true };
}

/**
 * 4. TENANT-BRANDED WELCOME CREDENTIALS EMAIL (Tenant → New Users: Staff, Students, Parents)
 * Sent when an admin creates a new user account. Includes login URL, username & initial password.
 * Styled with THE TENANT'S OWN BRANDING so it looks like it comes from the school itself.
 */
export async function sendWelcomeCredentialsEmail(options: {
  tenantId: string;
  recipientEmail: string;
  recipientName: string;
  role: 'teacher' | 'admin' | 'student' | 'parent';
  username: string;
  password?: string;
  activationUrl?: string;
  slug: string;
}): Promise<{ success: boolean; simulated?: boolean }> {
  const { tenantId, recipientEmail, recipientName, role, username, password, activationUrl, slug } = options;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, slug: true, branding: true },
  });

  if (!tenant) throw new Error('Tenant not found');

  const branding = (tenant.branding as any) || {};
  const primaryColor = branding.primaryColor || '#1E3A8A';
  const accentColor = branding.accentColor || '#2563EB';
  const logoUrl = branding.logoUrl || null;
  const schoolName = tenant.name;

  const portalPath = role === 'student' || role === 'parent' ? '/portal' : '/login';
  const loginUrl = getTenantUrl(slug, portalPath);
  const targetActionUrl = activationUrl || loginUrl;

  const roleLabels: Record<string, string> = {
    teacher: 'Teacher',
    admin: 'School Administrator',
    student: 'Student',
    parent: 'Parent / Guardian',
  };
  const roleLabel = roleLabels[role] || 'User';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
          .card { max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
          .header { background: linear-gradient(135deg, ${primaryColor}, ${accentColor}); padding: 32px; text-align: center; }
          .header img { max-height: 60px; margin-bottom: 12px; }
          .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; }
          .header p { margin: 6px 0 0 0; color: rgba(255,255,255,0.85); font-size: 13px; }
          .body { padding: 32px; }
          .greeting { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
          .text { font-size: 14px; line-height: 1.7; color: #475569; margin-bottom: 24px; }
          .cred-box { background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 20px 24px; margin-bottom: 24px; }
          .cred-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
          .cred-row:last-child { border-bottom: none; }
          .cred-label { color: #64748b; font-weight: 600; }
          .cred-value { color: #0f172a; font-weight: 700; font-family: monospace; font-size: 13px; background: #ffffff; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 8px; }
          .btn { display: inline-block; background: linear-gradient(135deg, ${primaryColor}, ${accentColor}); color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 32px; border-radius: 14px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
          .note { font-size: 12px; color: #94a3b8; margin-top: 16px; line-height: 1.6; }
          .footer { padding: 20px 32px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            ${logoUrl ? `<img src="${logoUrl}" alt="${schoolName} Logo">` : ''}
            <h1>${schoolName}</h1>
            <p>${activationUrl ? 'Activate Your Portal Account' : 'Your Portal Account Has Been Created'}</p>
          </div>
          <div class="body">
            <div class="greeting">Welcome, ${recipientName}!</div>
            <div class="text">
              Your <strong>${roleLabel}</strong> account at <strong>${schoolName}</strong> has been set up by the school administration. ${activationUrl ? 'Please activate your account and choose a secure password to get started.' : 'You can now sign in to access your portal using the credentials below.'}
            </div>

            <div class="cred-box">
              <div class="cred-row">
                <span class="cred-label">Portal</span>
                <span class="cred-value">${roleLabel} Portal</span>
              </div>
              <div class="cred-row">
                <span class="cred-label">Username</span>
                <span class="cred-value">${username}</span>
              </div>
              ${password ? `
              <div class="cred-row">
                <span class="cred-label">Temporary Password</span>
                <span class="cred-value">${password}</span>
              </div>
              ` : ''}
            </div>

            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${targetActionUrl}" class="btn">${activationUrl ? 'Activate Account & Set Password →' : 'Sign In to My Portal →'}</a>
            </div>

            <div class="note">
              ${activationUrl ? 'This secure activation link is valid for 48 hours. Please click above to set your password and access your dashboard. For your security, never share this link.' : 'For your security, please change your password after your first login. If you did not expect this email, please contact your school administrator immediately.'}
            </div>
          </div>
          <div class="footer">
            Official notification from <strong>${schoolName}</strong> • Powered by EduSaaS OS
          </div>
        </div>
      </body>
    </html>
  `;

  const result = await dispatchEmail({
    to: recipientEmail,
    subject: activationUrl ? `Activate Your ${roleLabel} Portal Account - ${schoolName}` : `Welcome to ${schoolName} — Your Portal Login Details`,
    html,
    fromName: schoolName,
    tenantId,
  });

  return { success: result.success, simulated: result.simulated };
}

/**
 * 5. RESULT PIN PURCHASE RECEIPT & CODE DELIVERY EMAIL
 * Sent immediately when a parent/guardian purchases a Result PIN online.
 * Delivers the 12-digit PIN code, purchase receipt, and direct link to unlock results.
 */
export async function sendResultPinPurchaseEmail(options: {
  tenantId: string;
  recipientEmail: string;
  pinCode: string;
  studentName: string;
  studentId: string;
  termName: string;
  pricePaid: number;
  paymentRef: string;
  slug: string;
}): Promise<{ success: boolean; simulated?: boolean }> {
  const {
    tenantId,
    recipientEmail,
    pinCode,
    studentName,
    studentId,
    termName,
    pricePaid,
    paymentRef,
    slug,
  } = options;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, slug: true, branding: true },
  });

  if (!tenant) throw new Error('Tenant not found');

  const branding = (tenant.branding as any) || {};
  const primaryColor = branding.primaryColor || '#0F172A';
  const accentColor = branding.accentColor || '#2563EB';
  const logoUrl = branding.logoUrl || null;
  const schoolName = tenant.name;

  const checkResultUrl = getTenantUrl(
    slug,
    `/results/check?studentId=${encodeURIComponent(studentId)}&pin=${encodeURIComponent(pinCode)}`
  );

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
          .card { max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
          .header { background: linear-gradient(135deg, ${primaryColor}, ${accentColor}); padding: 32px; text-align: center; }
          .header img { max-height: 60px; margin-bottom: 12px; }
          .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; }
          .header p { margin: 6px 0 0 0; color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 500; }
          .body { padding: 32px; }
          .pin-card { background: #f0fdf4; border: 2px dashed #22c55e; border-radius: 18px; padding: 24px; text-align: center; margin: 24px 0; }
          .pin-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #15803d; margin-bottom: 8px; }
          .pin-code { font-family: 'Courier New', Courier, monospace; font-size: 26px; font-weight: 900; letter-spacing: 0.15em; color: #166534; user-select: all; }
          .receipt-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
          .receipt-table td { padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
          .receipt-label { color: #64748b; font-weight: 600; width: 40%; }
          .receipt-val { color: #0f172a; font-weight: 700; text-align: right; }
          .btn { display: inline-block; background: linear-gradient(135deg, ${primaryColor}, ${accentColor}); color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 32px; border-radius: 14px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
          .footer { padding: 20px 32px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            ${logoUrl ? `<img src="${logoUrl}" alt="${schoolName} Logo">` : ''}
            <h1>${schoolName}</h1>
            <p>Official Online Result Checker PIN Receipt</p>
          </div>
          <div class="body">
            <h2 style="font-size: 18px; font-weight: 800; margin: 0 0 8px 0; color: #0f172a;">Your Result PIN is Ready</h2>
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
              Thank you for your payment. Your 12-digit Result PIN has been generated and activated for <strong>${studentName}</strong> (${studentId}).
            </p>

            <div class="pin-card">
              <div class="pin-label">Your 12-Digit Result PIN Code</div>
              <div class="pin-code">${pinCode}</div>
              <p style="font-size: 11px; color: #166534; margin: 8px 0 0 0; font-weight: 500;">
                Keep this PIN safe. It is required to view and download the official report card.
              </p>
            </div>

            <table class="receipt-table">
              <tr>
                <td class="receipt-label">Student Name</td>
                <td class="receipt-val">${studentName}</td>
              </tr>
              <tr>
                <td class="receipt-label">Student Reg / ID</td>
                <td class="receipt-val">${studentId}</td>
              </tr>
              <tr>
                <td class="receipt-label">Academic Term</td>
                <td class="receipt-val">${termName}</td>
              </tr>
              <tr>
                <td class="receipt-label">Amount Paid</td>
                <td class="receipt-val">₦${pricePaid.toLocaleString()}</td>
              </tr>
              <tr>
                <td class="receipt-label">Transaction Reference</td>
                <td class="receipt-val" style="font-family: monospace; font-size: 12px;">${paymentRef}</td>
              </tr>
            </table>

            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${checkResultUrl}" class="btn">View & Unlock Result Now →</a>
            </div>

            <p style="font-size: 12px; color: #94a3b8; line-height: 1.6; margin: 0;">
              Note: This PIN is locked to the specified student and term. For inquiries or support, please contact the school bursary or administrative office.
            </p>
          </div>
          <div class="footer">
            Official receipt from <strong>${schoolName}</strong> • Powered by EduSaaS OS
          </div>
        </div>
      </body>
    </html>
  `;

  const result = await dispatchEmail({
    to: recipientEmail,
    subject: `Your Result PIN Code (${pinCode}) — ${schoolName}`,
    html,
    fromName: schoolName,
    tenantId,
  });

  return { success: result.success, simulated: result.simulated };
}

/**
 * SUPER ADMIN PASSWORD RESET NOTIFICATION EMAIL
 * High-security dispatch with BMS Super Admin branding (#0b2f48 / #17834b).
 * Explicitly states 15-minute validity, single-use guarantee, and security warning.
 */
export async function sendSuperAdminPasswordResetEmail(options: {
  recipientEmail: string;
  adminName: string;
  resetUrl: string;
  expiresInMinutes?: number;
}): Promise<{ success: boolean; simulated?: boolean }> {
  const { recipientEmail, adminName, resetUrl, expiresInMinutes = 15 } = options;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Super Admin Password</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #102d43; }
          .card { max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(11, 47, 72, 0.1); }
          .header { background-color: #0b2f48; padding: 36px 32px; text-align: center; color: #ffffff; }
          .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 9999px; background-color: rgba(99, 210, 139, 0.15); border: 1px solid #63d28b; color: #63d28b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 12px; }
          .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
          .header p { margin: 6px 0 0 0; color: #d4e0e6; font-size: 13px; }
          .body { padding: 36px 32px; }
          .greeting { font-size: 17px; font-weight: 700; color: #102d43; margin-bottom: 12px; }
          .text { font-size: 14px; line-height: 1.65; color: #475569; margin-bottom: 24px; }
          .alert-box { background-color: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #17834b; border-radius: 12px; padding: 16px 20px; margin-bottom: 28px; }
          .alert-box p { margin: 0; font-size: 13px; line-height: 1.5; color: #334155; }
          .btn-container { text-align: center; margin: 32px 0; }
          .btn { display: inline-block; background-color: #17834b; color: #ffffff !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 14px rgba(23, 131, 75, 0.3); }
          .fallback { word-break: break-all; font-family: monospace; font-size: 12px; color: #64748b; background-color: #f1f5f9; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 16px; }
          .footer { padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="badge">Platform Security Advisory</div>
            <h1>BMS Platform Administration</h1>
            <p>Super Admin Password Reset Request</p>
          </div>
          <div class="body">
            <div class="greeting">Hello, ${adminName || 'Super Admin'}</div>
            <div class="text">
              We received a request to reset the password for your BMS Platform Super Admin account (<strong>${recipientEmail}</strong>).
            </div>

            <div class="alert-box">
              <p><strong>Security Notice:</strong> This link is valid for <strong>${expiresInMinutes} minutes</strong> and can only be used <strong>once</strong>. If you did not make this request, you can safely disregard this email—your account remains fully protected.</p>
            </div>

            <div class="btn-container">
              <a href="${resetUrl}" class="btn" target="_blank" rel="noopener noreferrer">Reset Super Admin Password →</a>
            </div>

            <div class="text" style="font-size: 12px; color: #64748b;">
              If the button above does not work, copy and paste this secure link directly into your browser:
              <div class="fallback">${resetUrl}</div>
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} BMS Platform Administration • Dedicated School Infrastructure
          </div>
        </div>
      </body>
    </html>
  `;

  const result = await dispatchEmail({
    to: recipientEmail,
    subject: 'Action Required: Reset Your BMS Super Admin Password',
    html,
    fromName: 'BMS Platform Administration',
  });

  return { success: result.success, simulated: result.simulated };
}

/**
 * SUPER ADMIN PASSWORD CHANGED SECURITY ALERT
 * Sent immediately after a successful password reset to notify the administrator.
 */
export async function sendSuperAdminPasswordChangedAlert(options: {
  recipientEmail: string;
  adminName: string;
}): Promise<{ success: boolean; simulated?: boolean }> {
  const { recipientEmail, adminName } = options;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Changed Notification</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #102d43; }
          .card { max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(11, 47, 72, 0.1); }
          .header { background-color: #0b2f48; padding: 32px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; }
          .body { padding: 36px 32px; }
          .greeting { font-size: 17px; font-weight: 700; color: #102d43; margin-bottom: 12px; }
          .text { font-size: 14px; line-height: 1.65; color: #475569; margin-bottom: 20px; }
          .alert-success { background-color: #ecfdf5; border: 1px solid #a7f3d0; border-left: 4px solid #10b981; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; color: #065f46; font-size: 13px; line-height: 1.5; }
          .footer { padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1>BMS Platform Security</h1>
          </div>
          <div class="body">
            <div class="greeting">Hello, ${adminName || 'Super Admin'}</div>
            <div class="alert-success">
              <strong>Confirmation:</strong> The password for your BMS Super Admin account (<strong>${recipientEmail}</strong>) was successfully updated.
            </div>
            <div class="text">
              All previous active login sessions have been terminated as a security precaution. If you performed this change, you may sign in normally using your new password.
            </div>
            <div class="text" style="color: #b91c1c; font-weight: 600;">
              ⚠️ If you did NOT initiate this change, contact platform engineering immediately to secure your infrastructure.
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} BMS Platform Administration
          </div>
        </div>
      </body>
    </html>
  `;

  const result = await dispatchEmail({
    to: recipientEmail,
    subject: 'Security Alert: Your BMS Super Admin Password Was Changed',
    html,
    fromName: 'BMS Platform Security',
  });

  return { success: result.success, simulated: result.simulated };
}
