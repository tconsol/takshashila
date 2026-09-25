// frontend/src/lib/excel-questions.ts
//
// Excel sheet → multiple-choice questions (columns: question, A, B, C, D, correct, explanation).
import * as XLSX from 'xlsx';
import type { IQuestion } from '../services/worksheets.service';

const EXCEL_EXTS = ['.xlsx', '.xls'];

export function isExcelFile(file: File) {
  return EXCEL_EXTS.some((ext) => file.name.toLowerCase().endsWith(ext));
}

export function parseExcelQuestions(file: File): Promise<IQuestion[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
        const questions: IQuestion[] = [];
        const errors: string[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every((c) => !c)) continue;
          const [q, optA, optB, optC, optD, correct, explanation] = row.map((c) => String(c ?? '').trim());
          if (!q) { errors.push(`Row ${i + 1}: empty question`); continue; }
          if (!optA || !optB || !optC || !optD) { errors.push(`Row ${i + 1}: need 4 options`); continue; }
          const cu = correct?.toUpperCase();
          if (!['A', 'B', 'C', 'D'].includes(cu)) { errors.push(`Row ${i + 1}: correct must be A/B/C/D`); continue; }
          const correctIndex = ({ A: 0, B: 1, C: 2, D: 3 } as Record<string, 0 | 1 | 2 | 3>)[cu];
          questions.push({ questionText: q, options: [optA, optB, optC, optD], correctIndex, explanation: explanation || '' });
        }
        if (errors.length > 0) { reject(new Error(errors.slice(0, 5).join('\n'))); return; }
        if (questions.length === 0) { reject(new Error('No valid questions found')); return; }
        resolve(questions);
      } catch { reject(new Error('Invalid Excel file')); }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}
