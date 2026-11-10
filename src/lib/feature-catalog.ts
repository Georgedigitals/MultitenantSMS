/**
 * Capabilities that already exist in BMS and can be connected to plan access.
 * A registry entry uses this exact key, which is also checked by the module's
 * server pages and APIs. Adding a label outside this catalog cannot grant access.
 */
export const BUILT_IN_FEATURE_CAPABILITIES = [
  { key: 'custom_domain', name: 'Custom Domain', description: 'CNAME domain mapping for school branding' },
  { key: 'result_pins', name: 'Result PIN System', description: 'Paid result-checker PINs for parent/student access' },
  { key: 'school_fees', name: 'School Fee Tracking', description: 'Fee item ledger and payment reconciliation' },
  { key: 'gallery', name: 'Public Gallery', description: 'Media gallery on the public school portal' },
  { key: 'notifications', name: 'In-app Notifications', description: 'Real-time in-app notification center' },
  { key: 'grading_customization', name: 'Grading Customization', description: 'Customize assessment components and grading scale bands' },
  { key: 'feature_sms_alerts', name: 'SMS Alerts Engine', description: 'Automated SMS broadcasts for fee receipts, results, and attendance' },
  { key: 'feature_whatsapp_alerts', name: 'WhatsApp Business Alerts', description: 'Direct WhatsApp notifications for report cards and invoices' },
  { key: 'feature_cbt_exams', name: 'CBT Online Exams Engine', description: 'Timed computer-based testing, auto-grading, and question banks' },
  { key: 'feature_bus_tracking', name: 'School Bus & Fleet Tracking', description: 'Transport routes, driver assignments, and student pickup rosters' },
  { key: 'id_cards', name: 'Student & Staff ID Cards', description: 'Generate and print school identity cards' },
  { key: 'staff_attendance', name: 'Staff Attendance', description: 'Staff clock-in, attendance roster, leave, and timesheets' },
  { key: 'timetable', name: 'Class Timetable', description: 'Create class schedules and show them to teachers, students, and parents' },
] as const;

export type BuiltInFeatureKey = (typeof BUILT_IN_FEATURE_CAPABILITIES)[number]['key'];

export function getAvailableFeatureCapabilities(registeredKeys: string[]) {
  const registered = new Set(registeredKeys);
  return BUILT_IN_FEATURE_CAPABILITIES.filter((capability) => !registered.has(capability.key));
}

export function isBuiltInFeatureKey(key: string): boolean {
  return BUILT_IN_FEATURE_CAPABILITIES.some((capability) => capability.key === key);
}
