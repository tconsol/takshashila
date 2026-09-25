// frontend/src/constants/programs.ts
export const PROGRAM_CATEGORIES = [
  { value: 'ARTS', label: 'Arts & Crafts' },
  { value: 'MUSIC', label: 'Music' },
  { value: 'GAMES', label: 'Games & Chess' },
  { value: 'CODING', label: 'Coding & Software' },
  { value: 'AI_DATA', label: 'AI & Data' },
  { value: 'LANGUAGES', label: 'Languages' },
  { value: 'LIFE_SKILLS', label: 'Life Skills' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const PROGRAM_LEVELS = [
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
] as const;

export const categoryLabel = (c: string) => PROGRAM_CATEGORIES.find((x) => x.value === c)?.label ?? c;
export const levelLabel = (l: string) => PROGRAM_LEVELS.find((x) => x.value === l)?.label ?? l;
