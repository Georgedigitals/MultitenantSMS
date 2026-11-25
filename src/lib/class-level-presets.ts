export type EducationSystemKey =
  | 'nigeria'
  | 'us_k12'
  | 'uk_british'
  | 'kenya_cbc'
  | 'francophone'
  | 'custom';

export interface EducationSystemPreset {
  key: EducationSystemKey;
  label: string;
  region: string;
  classes: string[];
}

export const EDUCATION_SYSTEM_PRESETS: EducationSystemPreset[] = [
  {
    key: 'us_k12',
    label: 'US / International (K–12)',
    region: 'United States & International',
    classes: [
      'Pre-K',
      'Kindergarten',
      'Grade 1',
      'Grade 2',
      'Grade 3',
      'Grade 4',
      'Grade 5',
      'Grade 6',
      'Grade 7',
      'Grade 8',
      'Grade 9',
      'Grade 10',
      'Grade 11',
      'Grade 12',
    ],
  },
  {
    key: 'uk_british',
    label: 'British / UK (Years)',
    region: 'United Kingdom & Commonwealth',
    classes: [
      'Nursery',
      'Reception',
      'Year 1',
      'Year 2',
      'Year 3',
      'Year 4',
      'Year 5',
      'Year 6',
      'Year 7',
      'Year 8',
      'Year 9',
      'Year 10',
      'Year 11',
      'Year 12',
    ],
  },
  {
    key: 'nigeria',
    label: 'Nigerian / West African',
    region: 'Nigeria, Ghana & West Africa',
    classes: [
      'Nursery 1',
      'Nursery 2',
      'Primary 1',
      'Primary 2',
      'Primary 3',
      'Primary 4',
      'Primary 5',
      'Primary 6',
      'JSS 1',
      'JSS 2',
      'JSS 3',
      'SSS 1',
      'SSS 2',
      'SSS 3',
    ],
  },
  {
    key: 'kenya_cbc',
    label: 'Kenyan CBC (PP1 – Grade 12)',
    region: 'Kenya & East Africa',
    classes: [
      'PP1',
      'PP2',
      'Grade 1',
      'Grade 2',
      'Grade 3',
      'Grade 4',
      'Grade 5',
      'Grade 6',
      'Grade 7',
      'Grade 8',
      'Grade 9',
      'Grade 10',
      'Grade 11',
      'Grade 12',
    ],
  },
  {
    key: 'francophone',
    label: 'Francophone (Maternelle – Terminale)',
    region: 'France & Francophone Africa',
    classes: [
      'Maternelle 1',
      'Maternelle 2',
      'CP',
      'CE1',
      'CE2',
      'CM1',
      'CM2',
      '6ème',
      '5ème',
      '4ème',
      '3ème',
      '2nde',
      '1ère',
      'Terminale',
    ],
  },
  {
    key: 'custom',
    label: 'Custom (Build Your Own)',
    region: 'Any Country / Custom Structure',
    classes: [],
  },
];

export function getPresetByKey(key?: string | null): EducationSystemPreset {
  return (
    EDUCATION_SYSTEM_PRESETS.find((p) => p.key === key) ||
    EDUCATION_SYSTEM_PRESETS.find((p) => p.key === 'nigeria')!
  );
}
