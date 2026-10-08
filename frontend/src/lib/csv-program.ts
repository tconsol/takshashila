// frontend/src/lib/csv-program.ts
//
// CSV → a Skill Program a tutor intends to create.
//
// Columns (one row per module; the program-level columns only need to be
// filled on the first data row — everything after that is read from column
// 9/10 only):
//   title, category, level, description, sessionCount,
//   sessionMinutes, price, maxEnrollees, moduleTitle (the chapter), moduleDescription,
//   topics (semicolon-separated topic titles of that chapter, optional)
import * as XLSX from 'xlsx';
import { PROGRAM_CATEGORIES, PROGRAM_LEVELS } from '../constants/programs';
import type { ProgramInput } from '../services/programs.service';

/** Must match PLATFORM_FEE_CENTS on the server (server/src/utils/currency.ts). */
const PLATFORM_FEE_CENTS = 100;

export const CSV_TEMPLATE_HEADERS = [
  'title', 'category', 'level', 'description',
  'sessionCount', 'sessionMinutes', 'price', 'maxEnrollees',
  'moduleTitle', 'moduleDescription', 'topics',
];

const CSV_SAMPLE_ROWS = [
  ['Chess for Beginners', 'GAMES', 'BEGINNER', 'Learn chess fundamentals from scratch', '8', '60', '40', '10', 'Introduction to the board', 'Piece names and the starting position', 'The board; The pieces; Setting up'],
  ['Chess for Beginners', 'GAMES', 'BEGINNER', 'Learn chess fundamentals from scratch', '8', '60', '40', '10', 'How each piece moves', '', 'Pawns and rooks; Bishops and knights; Queen and king'],
  ['Chess for Beginners', 'GAMES', 'BEGINNER', 'Learn chess fundamentals from scratch', '8', '60', '40', '10', 'Check, checkmate and basic tactics', '', 'Check; Checkmate; Forks and pins'],
];

export function isCsvFile(file: File): boolean {
  return file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv');
}

/** Downloads a ready-to-fill CSV so tutors don't have to guess the columns. */
export function downloadProgramCsvTemplate() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([CSV_TEMPLATE_HEADERS, ...CSV_SAMPLE_ROWS]);
  XLSX.utils.book_append_sheet(wb, ws, 'Program');
  XLSX.writeFile(wb, 'skill_program_template.csv', { bookType: 'csv' });
}

function matchEnum(raw: string, options: readonly { value: string; label: string }[]): string | undefined {
  const v = raw.trim().toLowerCase();
  return options.find((o) => o.value.toLowerCase() === v || o.label.toLowerCase() === v)?.value;
}

function parseIntOr(raw: string, fallback?: number): number | undefined {
  const v = raw.trim();
  if (v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

/** Same rule as isPriceAllowed() on the server (program.validators.ts). */
function isPriceAllowed(priceCents: number, sessionCount: number) {
  return priceCents === 0 || priceCents >= sessionCount * PLATFORM_FEE_CENTS;
}

export function parseProgramCsv(file: File): Promise<ProgramInput> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target!.result as string;
        const wb = XLSX.read(text, { type: 'string' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];

        const dataRows = rows.slice(1).filter((r) => r && r.some((c) => String(c ?? '').trim() !== ''));
        if (dataRows.length === 0) {
          reject(new Error('No data rows found — fill in the template below the header row.'));
          return;
        }

        const errors: string[] = [];
        const first = dataRows[0].map((c) => String(c ?? '').trim());
        const [titleRaw, categoryRaw, levelRaw, descriptionRaw, sessionCountRaw, sessionMinutesRaw, priceRaw, maxEnrolleesRaw] = first;

        const title = titleRaw?.trim();
        if (!title) errors.push('Row 2: title is required');

        const category = categoryRaw ? matchEnum(categoryRaw, PROGRAM_CATEGORIES) : undefined;
        if (!category) errors.push(`Row 2: category must be one of ${PROGRAM_CATEGORIES.map((c) => c.value).join(', ')}`);

        const level = levelRaw ? matchEnum(levelRaw, PROGRAM_LEVELS) : undefined;
        if (!level) errors.push(`Row 2: level must be one of ${PROGRAM_LEVELS.map((l) => l.value).join(', ')}`);

        const sessionCount = parseIntOr(sessionCountRaw ?? '');
        if (!sessionCount || sessionCount < 1) errors.push('Row 2: sessionCount must be a whole number of at least 1');

        const sessionMinutes = parseIntOr(sessionMinutesRaw ?? '', 60)!;
        if (Number.isNaN(sessionMinutes) || sessionMinutes < 15 || sessionMinutes > 240) errors.push('Row 2: sessionMinutes must be between 15 and 240');

        const priceDollars = (priceRaw ?? '').trim();
        const priceCents = priceDollars === '' ? 0 : Math.round(Number(priceDollars) * 100);
        if (Number.isNaN(priceCents) || priceCents < 0) errors.push('Row 2: price must be a non-negative number');
        else if (sessionCount && !isPriceAllowed(priceCents, sessionCount)) {
          errors.push(`Row 2: price must be free or at least $${(PLATFORM_FEE_CENTS / 100).toFixed(2)} per session (${sessionCount} sessions → minimum $${((PLATFORM_FEE_CENTS * sessionCount) / 100).toFixed(2)})`);
        }

        const maxEnrollees = parseIntOr(maxEnrolleesRaw ?? '');
        if (maxEnrollees !== undefined && (Number.isNaN(maxEnrollees) || maxEnrollees < 1)) errors.push('Row 2: maxEnrollees must be a positive whole number');

        const modules: ProgramInput['modules'] = [];
        dataRows.forEach((row, i) => {
          const moduleTitle = String(row[8] ?? '').trim();
          const moduleDescription = String(row[9] ?? '').trim();
          if (!moduleTitle) { errors.push(`Row ${i + 2}: moduleTitle is empty — every row needs a module title`); return; }
          const topics = String(row[10] ?? '').split(';').map((t) => t.trim()).filter(Boolean).map((title) => ({ title }));
          modules.push({ title: moduleTitle, description: moduleDescription || undefined, topics });
        });
        if (modules.length === 0) errors.push('At least one module (row) is required');

        if (errors.length > 0) {
          reject(new Error(errors.slice(0, 8).join('\n') + (errors.length > 8 ? `\n…and ${errors.length - 8} more` : '')));
          return;
        }

        resolve({
          title,
          category: category!,
          level: level!,
          description: descriptionRaw?.trim() || undefined,
          sessionCount: sessionCount!,
          sessionMinutes,
          priceCents,
          maxEnrollees,
          modules,
        });
      } catch {
        reject(new Error('Could not read that file. Make sure it is a .csv saved from the template.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// ── Chapters & topics only ──────────────────────────────────────────────────
// Columns: chapter, topic, chapterDescription. One row per topic; a blank
// chapter cell continues the chapter above. A chapter with no topic is allowed.
export const CHAPTERS_CSV_HEADERS = ['chapter', 'topic', 'chapterDescription'];

const CHAPTERS_SAMPLE_ROWS = [
  ['Introduction to the board', 'The board', 'Piece names and the starting position'],
  ['', 'The pieces', ''],
  ['', 'Setting up', ''],
  ['How each piece moves', 'Pawns and rooks', ''],
  ['', 'Bishops and knights', ''],
];

export type ParsedChapter = { title: string; description?: string; topics: Array<{ title: string }> };

export function downloadChaptersCsvTemplate() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([CHAPTERS_CSV_HEADERS, ...CHAPTERS_SAMPLE_ROWS]);
  XLSX.utils.book_append_sheet(wb, ws, 'Chapters');
  XLSX.writeFile(wb, 'program_chapters_template.csv', { bookType: 'csv' });
}

export function parseChaptersCsv(file: File): Promise<ParsedChapter[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target!.result as string, { type: 'string' });
        const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as string[][];
        const dataRows = rows.slice(1).filter((r) => r && r.some((c) => String(c ?? '').trim() !== ''));
        if (dataRows.length === 0) {
          reject(new Error('No data rows found — fill in the template below the header row.'));
          return;
        }

        const chapters: ParsedChapter[] = [];
        const errors: string[] = [];
        dataRows.forEach((row, i) => {
          const chapterTitle = String(row[0] ?? '').trim();
          const topicTitle = String(row[1] ?? '').trim();
          const description = String(row[2] ?? '').trim();
          const rowNo = i + 2;

          let chapter = chapterTitle
            ? chapters.find((c) => c.title.toLowerCase() === chapterTitle.toLowerCase())
            : chapters[chapters.length - 1];
          if (!chapter) {
            if (!chapterTitle) { errors.push(`Row ${rowNo}: chapter is empty and there is no chapter above to continue`); return; }
            chapter = { title: chapterTitle, topics: [] };
            chapters.push(chapter);
          }
          if (description && !chapter.description) chapter.description = description;
          if (topicTitle) chapter.topics.push({ title: topicTitle });
        });

        if (errors.length > 0) {
          reject(new Error(errors.slice(0, 8).join('\n') + (errors.length > 8 ? `\n…and ${errors.length - 8} more` : '')));
          return;
        }
        resolve(chapters);
      } catch {
        reject(new Error('Could not read that file. Make sure it is a .csv saved from the template.'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsText(file);
  });
}
