import { NextResponse } from 'next/server';
import { getSuperAdminFromCookies } from '@/lib/auth/super-admin-auth';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { DEFAULT_TRIAL_DAYS } from '@/lib/platform-settings';

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

  const defaultCurrencySymbol = map.get('defaultCurrencySymbol') || '₦';

  const rawPinFee = Number(map.get('defaultPinFeePercent'));
  const defaultPinFeePercent = !isNaN(rawPinFee) && rawPinFee >= 0 && rawPinFee <= 50
    ? rawPinFee
    : 5.0;

  const rawPinMaxUses = Number(map.get('defaultPinMaxUses'));
  const defaultPinMaxUses = Number.isInteger(rawPinMaxUses) && rawPinMaxUses >= 1 && rawPinMaxUses <= 20
    ? rawPinMaxUses
    : 5;

  const paystackPublicKey = map.get('paystackPublicKey') || process.env.NEXT_PUBLIC_PAYSTACK_KEY || '';
  const paystackSecretKey = map.get('paystackSecretKey') || process.env.PAYSTACK_SECRET_KEY || '';

  const smsGatewayProvider = map.get('smsGatewayProvider') || 'termii';

  const rawSmsCost = Number(map.get('smsCostPerUnit'));
  const smsCostPerUnit = !isNaN(rawSmsCost) && rawSmsCost >= 0
    ? rawSmsCost
    : 3.5;

  const termiiApiKey = map.get('termiiApiKey') || process.env.TERMII_API_KEY || '';

  return NextResponse.json({
    success: true,
    allowPublicRegistration,
    maintenanceMode,
    defaultTrialDays,
    defaultCurrencySymbol,
    defaultPinFeePercent,
    defaultPinMaxUses,
    paystackPublicKey,
    paystackSecretKey,
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
      adminName,
      adminEmail,
      newPassword,
      paystackPublicKey,
      paystackSecretKey,
      termiiApiKey,
      smsGatewayProvider,
      smsCostPerUnit,
      allowPublicRegistration,
      maintenanceMode,
      defaultTrialDays,
      defaultCurrencySymbol,
      defaultPinFeePercent,
      defaultPinMaxUses,
    } = body;

    const operations: ((tx: any) => Promise<any>)[] = [];

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

    // 2. Monetization Tab Settings
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
