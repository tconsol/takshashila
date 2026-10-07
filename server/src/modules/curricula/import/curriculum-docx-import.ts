import { readDocxParagraphs } from './docx-reader';
import { parseCurriculumDoc } from './curriculum-parser';
import { applyImport, type StateReport } from './curriculum-importer';
import { ConflictError, ValidationError } from '../../../utils/error';

// Two imports for one state would fight over the same drafts; keep it to one at a time.
let running = false;

/**
 * Parses an uploaded Word file and imports it for one state. `commit: false` is a dry run that
 * only reports what would change. Like the CLI, this writes DRAFTS: published curricula are
 * never touched, and re-importing rewrites drafts from the file.
 */
export async function importCurriculumDocx(
  file: Buffer,
  opts: { stateCode: string; kind: 'revised' | 'master'; countyOnly: boolean },
  commit: boolean,
): Promise<StateReport> {
  let doc;
  try {
    doc = parseCurriculumDoc(readDocxParagraphs(file));
  } catch (error) {
    throw new ValidationError({ file: [(error as Error).message] });
  }
  if (!opts.countyOnly && doc.grades.length === 0) {
    throw new ValidationError({ file: ['No grades found. Each grade should be a Heading 1 such as "Grade 3", with subjects as Heading 2 and chapters as Heading 3.'] });
  }
  if (running) throw new ConflictError('Another import is running. Try again in a moment.');
  running = true;
  try {
    return await applyImport({ path: 'upload.docx', ...opts }, doc, { commit });
  } finally {
    running = false;
  }
}
