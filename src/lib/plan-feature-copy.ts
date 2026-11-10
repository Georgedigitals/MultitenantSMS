type FeatureCopy = {
  name: string;
  description: string;
};

const featureCopy: Record<string, FeatureCopy> = {
  custom_domain: {
    name: 'Your school’s own domain',
    description: 'Use a web address that belongs to your school for its public site.',
  },
  result_pins: {
    name: 'Result access PINs',
    description: 'Create PINs that parents and students use to view published results.',
  },
  school_fees: {
    name: 'Fee tracking',
    description: 'Record fee items, track payments and reconcile what is still owed.',
  },
  gallery: {
    name: 'School photo gallery',
    description: 'Share school photos on the public school website.',
  },
  notifications: {
    name: 'In-app notifications',
    description: 'Keep important school updates in the staff workspace.',
  },
  grading_customization: {
    name: 'Custom grading scales',
    description: 'Set the assessment components and grade bands your school uses.',
  },
  feature_sms_alerts: {
    name: 'SMS alerts',
    description: 'Send text alerts about fee receipts, results and attendance.',
  },
  feature_whatsapp_alerts: {
    name: 'WhatsApp messages',
    description: 'Send report cards and invoices to families through WhatsApp.',
  },
  feature_cbt_exams: {
    name: 'Online exams',
    description: 'Create timed computer-based tests with question banks and auto-grading.',
  },
  feature_bus_tracking: {
    name: 'Transport management',
    description: 'Organise bus routes, driver assignments and student pickup rosters.',
  },
};

export function getPlanFeatureCopy(
  featureKey: string,
  fallbackName: string,
  fallbackDescription?: string | null,
): FeatureCopy {
  const knownCopy = featureCopy[featureKey];
  if (knownCopy) return knownCopy;

  return {
    name: fallbackName,
    description: fallbackDescription || 'Included with this school plan.',
  };
}
