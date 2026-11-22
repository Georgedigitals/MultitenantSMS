import { NextResponse } from 'next/server';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import {
  DEFAULT_PLATFORM_NAME,
  DEFAULT_PLATFORM_TAGLINE,
  DEFAULT_TRIAL_DAYS,
} from '@/lib/platform-settings';

export async function GET() {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized Super Admin access' }, { status: 401 });
  }

  const [settingsRecords, superAdminUser] = await Promise.all([
    prisma.platformSetting.findMany(),
    prisma.superAdmin.findUnique({
      where: { id: auth.superAdmin.id },
      select: { name: true, email: true },
    }),
  ]);

  const map = new Map<string, string>();
  for (const s of settingsRecords) {
    map.set(s.key, s.value);
  }

  const configuredDays = Number(map.get('defaultTrialDays'));
  const defaultTrialDays = Number.isInteger(configuredDays) && configuredDays >= 1 && configuredDays <= 90
    ? configuredDays
    : DEFAULT_TRIAL_DAYS;

  const allowPublicRegistration = map.has('allowPublicRegistration')
    ? map.get('allowPublicRegistration') === 'true'
    : true;

  const maintenanceMode = map.has('maintenanceMode')
    ? map.get('maintenanceMode') === 'true'
    : false;

  const platformName = map.get('platformName')?.trim() || DEFAULT_PLATFORM_NAME;
  const platformTagline = map.get('platformTagline')?.trim() || DEFAULT_PLATFORM_TAGLINE;

  const baseCurrencyCode = map.get('baseCurrencyCode') || 'NGN';
  const defaultCurrencyCode = map.get('defaultCurrencyCode') || 'NGN';
  const defaultCurrencySymbol = map.get('defaultCurrencySymbol') || '₦';
  const defaultLocale = map.get('defaultLocale') || 'en-NG';
  const parsedExRate = Number(map.get('currencyExchangeRate'));
  const currencyExchangeRate = Number.isFinite(parsedExRate) && parsedExRate > 0 ? parsedExRate : 1;
  const autoConvertCurrency = map.has('autoConvertCurrency')
    ? map.get('autoConvertCurrency') === 'true'
    : true;
  const defaultLanguage = map.get('defaultLanguage') || 'en';
  const defaultTimezone = map.get('defaultTimezone') || 'Africa/Lagos';
  let enabledLanguages: string[] = ['en', 'fr', 'es', 'pt', 'ar'];
  if (map.has('enabledLanguages')) {
    try {
      const parsed = JSON.parse(map.get('enabledLanguages') || '[]');
      if (Array.isArray(parsed) && parsed.length > 0) enabledLanguages = parsed;
    } catch {
      // fallback
    }
  }

  const rawPinFee = Number(map.get('defaultPinFeePercent'));
  const defaultPinFeePercent = !isNaN(rawPinFee) && rawPinFee >= 0 && rawPinFee <= 50
    ? rawPinFee
    : 5.0;

  const rawPinMaxUses = Number(map.get('defaultPinMaxUses'));
  const defaultPinMaxUses = Number.isInteger(rawPinMaxUses) && rawPinMaxUses >= 1 && rawPinMaxUses <= 20
    ? rawPinMaxUses
    : 5;

  const activePaymentGateway = map.get('activePaymentGateway') || 'paystack';
  const paystackPublicKey = map.get('paystackPublicKey') || process.env.NEXT_PUBLIC_PAYSTACK_KEY || '';
  const paystackSecretKey = map.get('paystackSecretKey') || process.env.PAYSTACK_SECRET_KEY || '';
  const flutterwavePublicKey = map.get('flutterwavePublicKey') || process.env.NEXT_PUBLIC_FLUTTERWAVE_KEY || '';
  const flutterwaveSecretKey = map.get('flutterwaveSecretKey') || process.env.FLUTTERWAVE_SECRET_KEY || '';
  const stripePublicKey = map.get('stripePublicKey') || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  const stripeSecretKey = map.get('stripeSecretKey') || process.env.STRIPE_SECRET_KEY || '';
  const stripeWebhookSecret = map.get('stripeWebhookSecret') || process.env.STRIPE_WEBHOOK_SECRET || '';

  const smsGatewayProvider = map.get('smsGatewayProvider') || 'termii';

  const rawSmsCost = Number(map.get('smsCostPerUnit'));
  const smsCostPerUnit = !isNaN(rawSmsCost) && rawSmsCost >= 0
    ? rawSmsCost
    : 3.5;

  const termiiApiKey = map.get('termiiApiKey') || process.env.TERMII_API_KEY || '';

  return NextResponse.json({
    success: true,
    platformName,
    platformTagline,
    allowPublicRegistration,
    maintenanceMode,
    defaultTrialDays,
    baseCurrencyCode,
    defaultCurrencyCode,
    defaultCurrencySymbol,
    defaultLocale,
    currencyExchangeRate,
    autoConvertCurrency,
    defaultLanguage,
    enabledLanguages,
    defaultTimezone,
    defaultPinFeePercent,
    defaultPinMaxUses,
    activePaymentGateway,
    paystackPublicKey,
    paystackSecretKey,
    flutterwavePublicKey,
    flutterwaveSecretKey,
    stripePublicKey,
    stripeSecretKey,
    stripeWebhookSecret,
    smsGatewayProvider,
    smsCostPerUnit,
    termiiApiKey,
    adminName: superAdminUser?.name || auth.superAdmin.name,
    adminEmail: superAdminUser?.email || auth.superAdmin.email,
  });
}

export async function POST(req: Request) {
  const auth = await getSuperAdminFromCookies();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized Super Admin access' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      platformName,
      platformTagline,
      adminName,
      adminEmail,
      newPassword,
      activePaymentGateway,
      paystackPublicKey,
      paystackSecretKey,
      flutterwavePublicKey,
      flutterwaveSecretKey,
      stripePublicKey,
      stripeSecretKey,
      stripeWebhookSecret,
      termiiApiKey,
      smsGatewayProvider,
      smsCostPerUnit,
      allowPublicRegistration,
      maintenanceMode,
      defaultTrialDays,
      baseCurrencyCode,
      defaultCurrencyCode,
      defaultCurrencySymbol,
      defaultLocale,
      currencyExchangeRate,
      autoConvertCurrency,
      defaultLanguage,
      enabledLanguages,
      defaultTimezone,
      defaultPinFeePercent,
      defaultPinMaxUses,
    } = body;

    const operations: ((tx: any) => Promise<any>)[] = [];

    // 0. Platform White-Label Identity
    if (platformName !== undefined) {
      const cleanName = String(platformName).trim();
      if (!cleanName || cleanName.length > 80) {
        return NextResponse.json(
          { error: 'Platform name must be between 1 and 80 characters' },
          { status: 400 }
        );
      }
      operations.push((tx) =>
        tx.platformSetting.upsert({
          where: { key: 'platformName' },
          create: { key: 'platformName', value: cleanName },
          update: { value: cleanName },
        })
      );
    }

    if (platformTagline !== undefined) {
      const cleanTagline = String(platformTagline).trim().slice(0, 160);
      operations.push((tx) =>
        tx.platformSetting.upsert({
          where: { key: 'platformTagline' },
          create: { key: 'platformTagline', value: cleanTagline },
          update: { value: cleanTagline },
        })
      );
    }

    // 1. General Tab Settings
    if (allowPublicRegistration !== undefined) {
      const val = String(Boolean(allowPublicRegistration));
      operations.push((tx) =>
        tx.platformSetting.upsert({
          where: { key: 'allowPublicRegistration' },
          create: { key: 'allowPublicRegistration', value: val },
          update: { value: val },
        })
      );
    }

    if (maintenanceMode !== undefined) {
      const val = String(Boolean(maintenanceMode));
      operations.push((tx) =>
        tx.platformSetting.upsert({
          where: { key: 'maintenanceMode' },
          create: { key: 'maintenanceMode', value: val },
          update: { value: val },
        })
      );
    }

    if (defaultTrialDays !== undefined) {
      const days = Number(defaultTrialDays);
      if (!Number.isInteger(days) || days < 1 || days > 90) {
        return NextResponse.json({ error: 'Trial duration must be an integer between 1 and 90 days' }, { status: 400 });
      }
      operations.push((tx) =>
        tx.platformSetting.upsert({
          where: { key: 'defaultTrialDays' },
          create: { key: 'defaultTrialDays', value: String(days) },
          update: { value: String(days) },
        })
      );
    }

    if (baseCurrencyCode !== undefined) {
      const base = String(baseCurrencyCode).trim().toUpperCase().slice(0, 6) || 'NGN';
      operations.push((tx) =>
        tx.platformSetting.upsert({
          where: { key: 'baseCurrencyCode' },
          create: { key: 'baseCurrencyCode', value: base },
          update: { value: base },
        })
      );
    }

    if (currencyExchangeRate !== undefined) {
      const rate = Number(currencyExchangeRate);
      if (Number.isFinite(rate) && rate > 0) {
        operations.push((tx) =>
          tx.platformSetting.upsert({
            where: { key: 'currencyExchangeRate' },
            create: { key: 'currencyExchangeRate', value: String(rate) },
            update: { value: String(rate) },
          })
        );
      }
    }

    if (autoConvertCurrency !== undefined) {
      const val = String(Boolean(autoConvertCurrency));
      operations.push((tx) =>
        tx.platformSetting.upsert({
          where: { key: 'autoConvertCurrency' },
          create: { key: 'autoConvertCurrency', value: val },
          update: { value: val },
        })
      );
    }

    if (defaultCurrencyCode !== undefined) {
      const code = String(defaultCurrencyCode).trim().toUpperCase().slice(0, 6) || 'NGN';
      operations.push((tx) =>
        tx.platformSetting.upsert({
          where: { key: 'defaultCurrencyCode' },
          create: { key: 'defaultCurrencyCode', value: code },
          update: { value: code },
        })
      );
    }

    if (defaultCurrencySymbol !== undefined) {
      const symbol = String(defaultCurrencySymbol).trim() || '₦';
      operations.push((tx) =>
        tx.platformSetting.upsert({
          where: { key: 'defaultCurrencySymbol' },
          create: { key: 'defaultCurrencySymbol', value: symbol },
          update: { value: symbol },
        })
      );
    }

    if (defaultLocale !== undefined) {
      const loc = String(defaultLocale).trim().slice(0, 20) || 'en-NG';
      operations.push((tx) =>
        tx.platformSetting.upsert({
          where: { key: 'defaultLocale' },
          create: { key: 'defaultLocale', value: loc },
          update: { value: loc },
        })
      );
    }

    if (defaultLanguage !== undefined) {
      const lang = String(defaultLanguage).trim().slice(0, 10) || 'en';
      operations.push((tx) =>
        tx.platformSetting.upsert({
          where: { key: 'defaultLanguage' },
          create: { key: 'defaultLanguage', value: lang },
          update: { value: lang },
        })
      );
    }

    if (Array.isArray(enabledLanguages) && enabledLanguages.length > 0) {
      const cleanLangs = enabledLanguages.map((l: any) => String(l).trim().slice(0, 10)).filter(Boolean);
      if (cleanLangs.length > 0) {
        operations.push((tx) =>
          tx.platformSetting.upsert({
            where: { key: 'enabledLanguages' },
            create: { key: 'enabledLanguages', value: JSON.stringify(cleanLangs) },
            update: { value: JSON.stringify(cleanLangs) },
          })
        );
      }
    }

    if (defaultTimezone !== undefined) {
      const tz = String(defaultTimezone).trim().slice(0, 60) || 'Africa/Lagos';
      operations.push((tx) =>
        tx.platformSetting.upsert({
          where: { key: 'defaultTimezone' },
          create: { key: 'defaultTimezone', value: tz },
          update: { value: tz },
        })
      );
    }

    // 2. Monetization Tab Settings
    if (activePaymentGateway !== undefined) {
      const gw = ['paystack', 'flutterwave', 'stripe'].includes(String(activePaymentGateway))
        ? String(activePaymentGateway)
        : 'paystack';
      operations.push((tx) =>
        tx.platformSetting.upsert({
          where: { key: 'activePaymentGateway' },
          create: { key: 'activePaymentGateway', value: gw },
          update: { value: gw },
        })
      );
    }

    for (const [key, val] of [
      ['flutterwavePublicKey', flutterwavePublicKey],
      ['flutterwaveSecretKey', flutterwaveSecretKey],
      ['stripePublicKey', stripePublicKey],
      ['stripeSecretKey', stripeSecretKey],
      ['stripeWebhookSecret', stripeWebhookSecret],
    ] as const) {
      if (val !== undefined) {
        const clean = String(val).trim();
        operations.push((tx) =>
          tx.platformSetting.upsert({
            where: { key },
            create: { key, value: clean },
            update: { value: clean },
          })
        );
      }
    }

    if (defaultPinFeePercent !== undefined) {
      const fee = Number(defaultPinFeePercent);
      if (isNaN(fee) || fee < 0 || fee > 50) {
        return NextResponse.json({ error: 'Platform PIN fee percent must be between 0% and 50%' }, { status: 400 });
      }
      operations.push((tx) =>
        tx.platformSetting.upsert({
          where: { key: 'defaultPinFeePercent' },
          create: { key: 'defaultPinFeePercent', value: String(fee) },
          update: { value: String(fee) },
        })
      );
    }

    if (defaultPinMaxUses !== undefined) {
      const maxUses = Number(defaultPinMaxUses);
      if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 20) {
        return NextResponse.json({ error: 'PIN max uses must be an integer between 1 and 20' }, { status: 400 });
      }
      operations.push((tx) =>
        tx.platformSetting.upsert({
          where: { key: 'defaultPinMaxUses' },
          create: { key: 'defaultPinMaxUses', value: String(maxUses) },
          update: { value: String(maxUses) },
        })
      );
    }

    if (paystackPublicKey !== undefined) {
      const pubKey = String(paystackPublicKey).trim();
      operations.push((tx) =>
        tx.platformSetting.upsert({
          where: { key: 'paystackPublicKey' },
          create: { key: 'paystackPublicKey', value: pubKey },
          update: { value: pubKey },
        })
      );
    }

    if (paystackSecretKey !== undefined && !String(paystackSecretKey).includes('••••')) {
      const secKey = String(paystackSecretKey).trim();
      operations.push((tx) =>
        tx.platformSetting.upsert({
          where: { key: 'paystackSecretKey' },
          create: { key: 'paystackSecretKey', value: secKey },
          update: { value: secKey },
        })
      );
    }

    // 3. SMS & Gateways Tab Settings
    if (smsGatewayProvider !== undefined) {
      const prov = String(smsGatewayProvider).trim();
      operations.push((tx) =>
        tx.platformSetting.upsert({
          where: { key: 'smsGatewayProvider' },
          create: { key: 'smsGatewayProvider', value: prov },
          update: { value: prov },
        })
      );
    }

    if (smsCostPerUnit !== undefined) {
      const cost = Number(smsCostPerUnit);
      if (isNaN(cost) || cost < 0) {
        return NextResponse.json({ error: 'SMS cost per unit must be a non-negative number' }, { status: 400 });
      }
      operations.push((tx) =>
        tx.platformSetting.upsert({
          where: { key: 'smsCostPerUnit' },
          create: { key: 'smsCostPerUnit', value: String(cost) },
          update: { value: String(cost) },
        })
      );
    }

    if (termiiApiKey !== undefined && !String(termiiApiKey).includes('••••')) {
      const key = String(termiiApiKey).trim();
      operations.push((tx) =>
        tx.platformSetting.upsert({
          where: { key: 'termiiApiKey' },
          create: { key: 'termiiApiKey', value: key },
          update: { value: key },
        })
      );
    }

    // 4. Security Tab: Super Admin Profile & Credentials
    const adminUpdateData: any = {};
    if (adminName && String(adminName).trim()) {
      adminUpdateData.name = String(adminName).trim();
    }
    if (adminEmail && String(adminEmail).trim()) {
      const cleanEmail = String(adminEmail).trim().toLowerCase();
      const existing = await prisma.superAdmin.findFirst({
        where: { email: cleanEmail, id: { not: auth.superAdmin.id } },
      });
      if (existing) {
        return NextResponse.json({ error: 'This email address is already in use by another admin.' }, { status: 400 });
      }
      adminUpdateData.email = cleanEmail;
    }

    if (newPassword && String(newPassword).trim()) {
      const trimmedPw = String(newPassword).trim();
      if (trimmedPw.length < 6) {
        return NextResponse.json({ error: 'New password must be at least 6 characters long' }, { status: 400 });
      }
      adminUpdateData.passwordHash = await bcrypt.hash(trimmedPw, 10);
    }

    if (Object.keys(adminUpdateData).length > 0) {
      operations.push((tx) =>
        tx.superAdmin.update({
          where: { id: auth.superAdmin.id },
          data: adminUpdateData,
        })
      );
    }

    if (operations.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const op of operations) {
          await op(tx);
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Global platform configuration and credentials updated successfully.',
    });
  } catch (err: any) {
    console.error('Error updating platform settings:', err);
    return NextResponse.json({ error: err?.message || 'Failed to update settings' }, { status: 500 });
  }
}
