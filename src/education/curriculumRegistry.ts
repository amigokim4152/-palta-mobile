export type CurriculumStatus = 'current' | 'proposed' | 'superseded' | 'retired';

export interface CurriculumSourceRef {
  id: string;
  url: string;
  publisher: string;
  checkedAt: string;
  note?: string;
}

export interface CurriculumFramework {
  id: string;
  country: string;
  levelRange: string;
  title: string;
  status: CurriculumStatus;
  legalRefs: string[];
  validAsOf: string;
  sourceRefs: string[];
}

export interface CurriculumSubject {
  id: string;
  country: string;
  grade: string;
  name: string;
  required: boolean;
  condition?: string;
  frameworkId: string;
}

export interface CurriculumObjectiveRef {
  id: string;
  country: string;
  grade: string;
  subjectId: string;
  officialCode: string;
  frameworkId: string;
  sourceUrl: string;
  sourceCheckedAt: string;
  officialTextStored: false;
  conceptRefs: string[];
}

export const CHILE_1_6_BASIC_CURRENT: CurriculumFramework = {
  id: 'CL-CURRICULUM-1-6-BASICO-2012',
  country: 'CL',
  levelRange: '1_basico..6_basico',
  title: 'Bases Curriculares 1° a 6° Básico',
  status: 'current',
  legalRefs: ['Decreto 433/2012', 'Decreto 439/2012'],
  validAsOf: '2026-09-18',
  sourceRefs: ['MINEDUC-CARTILLA-VIGENTE-2026', 'MINEDUC-BASES-1-6'],
};

export const CHILE_FIRST_GRADE_SUBJECTS: CurriculumSubject[] = [
  ['language', 'Lenguaje y Comunicación'],
  ['math', 'Matemática'],
  ['science', 'Ciencias Naturales'],
  ['history', 'Historia, Geografía y Ciencias Sociales'],
  ['visual-arts', 'Artes Visuales'],
  ['music', 'Música'],
  ['physical-education-health', 'Educación Física y Salud'],
  ['technology', 'Tecnología'],
  ['orientation', 'Orientación'],
].map(([key, name]) => ({
  id: `CL-1B-${key}`,
  country: 'CL',
  grade: '1_basico',
  name,
  required: true,
  frameworkId: CHILE_1_6_BASIC_CURRENT.id,
}));

export const CHILE_FIRST_GRADE_OBJECTIVE_SEEDS: CurriculumObjectiveRef[] = [
  {
    id: 'CL-1B-MATH-OA01',
    country: 'CL',
    grade: '1_basico',
    subjectId: 'CL-1B-math',
    officialCode: 'MA01 OA 01',
    frameworkId: CHILE_1_6_BASIC_CURRENT.id,
    sourceUrl: 'https://www.curriculumnacional.cl/docentes/Educacion-General/Matematica-1-basico/MA01-OA-01/17473:MA01-OA-01',
    sourceCheckedAt: '2026-09-18',
    officialTextStored: false,
    conceptRefs: ['KNOW-MATH-COUNTING-001'],
  },
  {
    id: 'CL-1B-LANG-OA01',
    country: 'CL',
    grade: '1_basico',
    subjectId: 'CL-1B-language',
    officialCode: 'LE01 OA 01',
    frameworkId: CHILE_1_6_BASIC_CURRENT.id,
    sourceUrl: 'https://www.curriculumnacional.cl/614/w3-article-17114.html',
    sourceCheckedAt: '2026-09-18',
    officialTextStored: false,
    conceptRefs: ['KNOW-LITERACY-WRITTEN-MESSAGE-001'],
  },
];
