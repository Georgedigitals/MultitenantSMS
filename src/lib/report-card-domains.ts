export const AFFECTIVE_TRAITS = [
  'Attentiveness',
  'Honesty',
  'Neatness',
  'Politeness',
  'Punctuality/ Assembly',
  'Self Control/ Calmness',
  'Obedience',
  'Reliability',
  'Sense Of Responsibility',
  'Relationship With Others',
] as const;

export const PSYCHOMOTOR_TRAITS = [
  'Handling Of Tools',
  'Drawing/ Painting',
  'Handwriting',
  'Public Speaking',
  'Speech Fluency',
  'Sports & Games',
] as const;

export type TraitRatings = Record<string, number | null>;

export function emptyTraitRatings(traits: readonly string[]): TraitRatings {
  return Object.fromEntries(traits.map((trait) => [trait, null]));
}

export function isTraitRatingsComplete(
  ratings: Record<string, unknown> | null | undefined,
  traits: readonly string[]
): boolean {
  return traits.every((trait) => {
    const score = ratings?.[trait];
    return typeof score === 'number' && Number.isInteger(score) && score >= 1 && score <= 5;
  });
}

export function isValidTraitRatings(
  ratings: unknown,
  traits: readonly string[]
): ratings is TraitRatings {
  if (!ratings || typeof ratings !== 'object' || Array.isArray(ratings)) return false;
  const value = ratings as Record<string, unknown>;
  return Object.keys(value).every((key) => key === '_remarks' || key === 'remarks' || traits.includes(key)) && traits.every((trait) => {
    const score = value[trait];
    return score === null || (typeof score === 'number' && Number.isInteger(score) && score >= 1 && score <= 5);
  });
}

export function normalizeTraitRatings(
  ratings: unknown,
  traits: readonly string[]
): TraitRatings {
  const result = emptyTraitRatings(traits);
  if (!ratings || typeof ratings !== 'object' || Array.isArray(ratings)) return result;
  const source = ratings as Record<string, unknown>;
  for (const trait of traits) {
    const score = source[trait];
    if (typeof score === 'number' && Number.isInteger(score) && score >= 1 && score <= 5) {
      result[trait] = score;
    }
  }
  return result;
}
