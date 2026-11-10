export type NumericValue = number | string | { toNumber?: () => number; toString(): string };

export interface AssessmentComponentLike {
  id?: string;
  name: string;
  maxScore: number;
  weightPercent: NumericValue;
}

export interface GradingScaleLike {
  id?: string;
  lowestClassLevelId?: string;
  highestClassLevelId?: string;
  lowestClassLevel?: { id: string; orderIndex: number };
  highestClassLevel?: { id: string; orderIndex: number };
  minScore: NumericValue;
  maxScore: NumericValue;
  grade: string;
  remark: string;
}

/**
 * Normalizes component name keys to match score data flexibly.
 * e.g., "1st CA" -> "1st_ca", "1st ca", "1stCA"
 */
function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Computes the total weighted score (0-100) from component scores.
 * 
 * Each component defines maxScore and weightPercent.
 * Contribution = (score / maxScore) * weightPercent.
 * When maxScore == weightPercent (e.g. 20 and 20%), contribution is exactly score.
 */
export function computeTotal(
  scoreData: Record<string, number | string | null | undefined>,
  components: AssessmentComponentLike[]
): number {
  if (!components || components.length === 0) {
    return 0;
  }

  // Create a normalized lookup map of scoreData
  const scoreLookup = new Map<string, number>();
  for (const [key, val] of Object.entries(scoreData || {})) {
    if (val !== null && val !== undefined && val !== '') {
      const num = typeof val === 'number' ? val : parseFloat(String(val));
      if (!isNaN(num)) {
        scoreLookup.set(key, num);
        scoreLookup.set(key.toLowerCase(), num);
        scoreLookup.set(normalizeKey(key), num);
      }
    }
  }

  let total = 0;

  for (const comp of components) {
    let score: number | undefined;

    if (comp.id && scoreLookup.has(comp.id)) {
      score = scoreLookup.get(comp.id);
    } else if (scoreLookup.has(comp.name)) {
      score = scoreLookup.get(comp.name);
    } else if (scoreLookup.has(comp.name.toLowerCase())) {
      score = scoreLookup.get(comp.name.toLowerCase());
    } else if (scoreLookup.has(normalizeKey(comp.name))) {
      score = scoreLookup.get(normalizeKey(comp.name));
    }

    if (score !== undefined && comp.maxScore > 0) {
      const weight = typeof comp.weightPercent === 'number' 
        ? comp.weightPercent 
        : parseFloat(String(comp.weightPercent));
      
      const compContribution = (score / comp.maxScore) * weight;
      total += compContribution;
    }
  }

  // Round to 2 decimal places to eliminate floating point artifacts
  return Math.round(total * 100) / 100;
}

/**
 * Resolves a letter grade and remark from a numeric total score and class level,
 * matching against the tenant's GradingScale entries scoped to class-level bands.
 */
export function resolveGrade(
  total: number,
  classLevelOrderIndex: number,
  gradingScales: GradingScaleLike[]
): { grade: string; remark: string } | null {
  if (!gradingScales || gradingScales.length === 0) {
    return null;
  }

  for (const scale of gradingScales) {
    const min = typeof scale.minScore === 'number' ? scale.minScore : parseFloat(String(scale.minScore));
    const max = typeof scale.maxScore === 'number' ? scale.maxScore : parseFloat(String(scale.maxScore));

    // Check class-level band scoping if order indices are available
    if (scale.lowestClassLevel && scale.highestClassLevel) {
      const minOrder = Math.min(scale.lowestClassLevel.orderIndex, scale.highestClassLevel.orderIndex);
      const maxOrder = Math.max(scale.lowestClassLevel.orderIndex, scale.highestClassLevel.orderIndex);
      if (classLevelOrderIndex < minOrder || classLevelOrderIndex > maxOrder) {
        continue;
      }
    }

    const rounded = Math.round(total);
    if ((total >= min && total <= max) || (rounded >= min && rounded <= max)) {
      return {
        grade: scale.grade,
        remark: scale.remark,
      };
    }
  }

  return null;
}

/**
 * Generates a preview grade (for live UX in teacher/admin forms).
 * Never saved to database; ResultEntry.grade is only populated at publish time.
 */
export function previewGrade(
  total: number,
  classLevelOrderIndex: number,
  gradingScales: GradingScaleLike[]
): { total: number; grade: string | null; remark: string | null; isPreview: true } {
  const resolved = resolveGrade(total, classLevelOrderIndex, gradingScales);
  return {
    total,
    grade: resolved ? resolved.grade : null,
    remark: resolved ? resolved.remark : null,
    isPreview: true,
  };
}
