/**
 * Free Trial Lifecycle & Grace Period Engine (§Multi-Tenant SaaS Lifecycle).
 * 
 * Manages configurable trials, expiry countdowns,
 * and subscription tier activation.
 */

export interface TenantTrialInfo {
  isTrial: boolean;
  isExpired: boolean;
  isGracePeriod: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  trialEndsAt: Date | null;
  status: string;
}


/**
 * Computes trial metrics from a tenant's status and trialEndsAt timestamp.
 */
export function getTenantTrialStatus(tenant: {
  status: string;
  trialEndsAt?: Date | string | null;
}): TenantTrialInfo {
  const isTrial = tenant.status === 'trial';

  if (!tenant.trialEndsAt) {
    const isExpired = isTrial;
    return {
      isTrial,
      isExpired,
      isGracePeriod: false,
      daysRemaining: 0,
      hoursRemaining: 0,
      trialEndsAt: null,
      status: tenant.status,
    };
  }

  const trialEnd = new Date(tenant.trialEndsAt);
  const now = new Date();
  const diffMs = trialEnd.getTime() - now.getTime();

  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const hoursRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));
  const isExpired = isTrial && diffMs <= 0;
  const isGracePeriod = false;

  return {
    isTrial,
    isExpired,
    isGracePeriod,
    daysRemaining,
    hoursRemaining,
    trialEndsAt: trialEnd,
    status: tenant.status,
  };
}

/**
 * Checks whether the tenant's current trial or subscription grants operational access.
 */
export function checkTrialAccess(tenant: {
  status: string;
  trialEndsAt?: Date | string | null;
}): { allowed: boolean; warning?: string; reason?: string } {
  if (tenant.status === 'active') {
    return { allowed: true };
  }

  if (tenant.status === 'trial') {
    const trialStatus = getTenantTrialStatus(tenant);

    if (!trialStatus.isExpired) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: 'Your school trial has ended. Please choose a subscription plan to continue.',
    };
  }

  if (tenant.status === 'suspended') {
    return { allowed: false, reason: 'This school workspace has been suspended by administration.' };
  }

  return { allowed: true };
}
