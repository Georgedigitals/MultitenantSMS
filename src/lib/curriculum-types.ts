export type DepartmentTrack = 'science' | 'arts' | 'commercial' | 'general';

export interface ClassSubjectOffering {
  subjectId: string;
  isElective: boolean;
  department?: DepartmentTrack;
  departments?: DepartmentTrack[];
}

export interface TenantCurriculumConfig {
  classes: Record<string, ClassSubjectOffering[]>;
}

/**
 * Normalizes and retrieves the department tracks associated with a subject offering.
 * Supports both modern `departments: DepartmentTrack[]` and legacy single `department`.
 */
export function getOfferingDepartments(offering?: ClassSubjectOffering | null): DepartmentTrack[] {
  if (!offering) return [];
  if (Array.isArray(offering.departments) && offering.departments.length > 0) {
    return Array.from(new Set(offering.departments));
  }
  if (offering.department) {
    return [offering.department];
  }
  return ['general'];
}

/**
 * Checks whether a class level belongs to Senior Secondary / High School (where electives apply).
 * In the Nigerian / British standard ladder:
 * - Order index 1-3: Nursery
 * - Order index 4-9: Primary 1-6
 * - Order index 10-12: JSS 1-3 (Junior Secondary)
 * - Order index 13-15: SSS 1-3 (Senior Secondary)
 */
export function isSeniorSecondaryClass(classLevel?: { name?: string; orderIndex?: number } | null): boolean {
  if (!classLevel) return false;

  const name = (classLevel.name || '').toLowerCase().trim();

  // Explicitly exclude Junior, Primary, Nursery, Basic classes first
  if (
    name.includes('jss') ||
    name.includes('junior') ||
    name.includes('primary') ||
    name.includes('nursery') ||
    name.includes('creche') ||
    name.includes('kindergarten') ||
    name.includes('basic') ||
    name.includes('pry')
  ) {
    return false;
  }

  // Explicitly match Senior secondary patterns
  if (
    /\bsss\b/i.test(name) ||
    /\bsss\s*[1-3]\b/i.test(name) ||
    /\bss\s*[1-3]\b/i.test(name) ||
    /\bsenior\b/i.test(name) ||
    /\b(grade|year)\s*(10|11|12)\b/i.test(name)
  ) {
    return true;
  }

  // Fallback to standard educational ladder:
  // Order index 1-3: Nursery 1-3
  // Order index 4-9: Primary 1-6
  // Order index 10-12: JSS 1-3 (Junior Secondary)
  // Order index 13-15: SSS 1-3 (Senior Secondary)
  if (typeof classLevel.orderIndex === 'number' && classLevel.orderIndex > 0) {
    return classLevel.orderIndex >= 13;
  }

  return false;
}

/**
 * Resolves the effective list of subject IDs a student is enrolled in for a class.
 * - For Junior/Primary: Returns all subjects assigned to that class (100% core).
 * - For Senior: Returns all Core subjects + the student's departmental track electives
 *   and custom elective subject IDs.
 */
export function resolveStudentSubjectIds(params: {
  classLevelId: string;
  classLevel?: { name?: string; orderIndex?: number } | null;
  curriculum: TenantCurriculumConfig;
  studentContactInfo?: any;
  teachingAssignmentsForClass?: Array<{ subjectId: string }>;
}): string[] {
  const { classLevelId, classLevel, curriculum, studentContactInfo, teachingAssignmentsForClass = [] } = params;
  const isSenior = isSeniorSecondaryClass(classLevel);

  // 1. Get class offerings from curriculum configuration
  const configuredOfferings = curriculum.classes[classLevelId] || [];

  // Fallback: If no custom curriculum was configured, use teaching assignments as Core subjects
  if (configuredOfferings.length === 0) {
    return Array.from(new Set(teachingAssignmentsForClass.map((ta) => ta.subjectId)));
  }

  // 2. For Junior/Primary classes: All configured subjects are Core
  if (!isSenior) {
    return configuredOfferings.map((o) => o.subjectId);
  }

  // 3. For Senior Secondary classes:
  // Core subjects are mandatory for all students in the class
  const coreSubjectIds = configuredOfferings.filter((o) => !o.isElective).map((o) => o.subjectId);

  // Extract student's department track and custom electives
  const track = (studentContactInfo?.departmentTrack as DepartmentTrack) || 'general';
  const customElectiveIds = Array.isArray(studentContactInfo?.electiveSubjectIds)
    ? studentContactInfo.electiveSubjectIds
    : [];

  // Track-based electives: match subjects assigned to this department (supports multi-department electives)
  const trackElectiveIds = configuredOfferings
    .filter((o) => {
      if (!o.isElective) return false;
      const depts = getOfferingDepartments(o);
      if (track === 'general') {
        return depts.includes('general');
      }
      return depts.includes(track) || depts.includes('general');
    })
    .map((o) => o.subjectId);

  // Combine Core + Track Electives + Custom Specific Electives
  return Array.from(new Set([...coreSubjectIds, ...trackElectiveIds, ...customElectiveIds]));
}

