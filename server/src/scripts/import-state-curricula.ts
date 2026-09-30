/**
 * Imports state curricula from the Word files into the database as DRAFTS.
 *
 *   npx ts-node --transpile-only src/scripts/import-state-curricula.ts --dir "D:\Brainbaseedu Cirriculums"
 *   npx ts-node --transpile-only src/scripts/import-state-curricula.ts --dir "..." --commit --confirm-db=<dbname> [--backup-dir=<dir>]
 *
 * Default is a DRY RUN: nothing is written to the database. --commit additionally requires
 * --confirm-db=<the connected database name>; a full backup of the `curricula` and
 * `countyadditions` collections is written before the first change.
 *
 * WARNING: re-running REWRITES DRAFT curricula wholesale from the Word files. Admin edits made
 * to drafts are lost. Published curricula are never touched. Run only ONE import at a time.
 */
import fs from 'fs';
import path from 'path';
import { stateCodeFromName } from '../modules/geo/state-codes';
import { readDocxParagraphs } from '../modules/curricula/import/docx-reader';
import { parseCurriculumDoc } from '../modules/curricula/import/curriculum-parser';
import { applyImport, type StateReport } from '../modules/curricula/import/curriculum-importer';

export const WARNING =
  'WARNING: re-running rewrites DRAFT curricula wholesale (admin edits to drafts are lost; published ones are never touched).\n' +
  'WARNING: only ONE import run should be active at a time.';

export interface ManifestEntry { file: string; stateCode: string; kind: 'revised' | 'master'; countyOnly?: boolean }

const REVISED = 'Revised Cirriculum';
const entry = (file: string, kind: 'revised' | 'master', countyOnly?: boolean): ManifestEntry => {
  const name = path.basename(file).split('_')[0];
  const stateCode = stateCodeFromName(name);
  if (!stateCode) throw new Error(`Cannot derive a state from file name ${file}`);
  return { file, stateCode, kind, ...(countyOnly ? { countyOnly } : {}) };
};

/** Alaska/Colorado curricula come from the revised files; their master files supply county additions only. */
export const MANIFEST: ManifestEntry[] = [
  entry(`${REVISED}/Alaska_Revised_Curriculum.docx`, 'revised'),
  entry(`${REVISED}/Colorado_Revised_Curriculum.docx`, 'revised'),
  entry(`${REVISED}/Hawaii_Revised_Curriculum.docx`, 'revised'),
  entry(`${REVISED}/Idaho_Revised_Curriculum.docx`, 'revised'),
  entry(`${REVISED}/Iowa_Revised_Curriculum.docx`, 'revised'),
  entry(`${REVISED}/Louisiana_Revised_Curriculum.docx`, 'revised'),
  entry('Georgia_State_Master_Syllabus_with_County_Additions (1).docx', 'master'),
  entry('Alaska_State_Master_Syllabus_with_County_Additions.docx', 'master', true),
  entry('Colorado_State_Master_Syllabus_with_County_Additions.docx', 'master', true),
];

/** Two full (non-countyOnly) files for one state would fight over the same drafts. */
export function validateManifest(entries: ManifestEntry[]): void {
  const seen = new Set<string>();
  for (const e of entries) {
    if (e.countyOnly) continue;
    if (seen.has(e.stateCode)) throw new Error(`Manifest has two non-countyOnly files for state ${e.stateCode}`);
    seen.add(e.stateCode);
  }
}

export function checkCommitGuard(args: { commit: boolean; confirmDb?: string; connectedDb: string; backupPath?: string }): void {
  if (!args.commit) return;
  if (!args.confirmDb) throw new Error(`--commit requires --confirm-db=<database name> (connected to "${args.connectedDb}")`);
  if (args.confirmDb !== args.connectedDb) {
    throw new Error(`--confirm-db "${args.confirmDb}" does not match the connected database "${args.connectedDb}"`);
  }
  if (!args.backupPath) throw new Error('--commit requires a backup file to have been written first');
}

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) out[a.slice(2)] = true;
    else out[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return out;
}

const USAGE = `Usage: import-state-curricula.ts --dir <folder with the Word files> [--commit --confirm-db=<db> --backup-dir=<dir>] [--report-dir=<dir>]

Dry run by default (no database writes). With --commit a backup of curricula + countyadditions is written first.

${WARNING}`;

const NUM_KEYS = ['created', 'updated', 'unchanged', 'skippedPublished', 'chapters', 'topics', 'countyAdditions'] as const;

function printReports(reports: { entry: ManifestEntry; report: StateReport }[]): void {
  const row = (label: string, kind: string, co: string, r: Record<(typeof NUM_KEYS)[number], number>) =>
    `${label.padEnd(6)} ${kind.padEnd(8)} ${co.padEnd(11)} ${NUM_KEYS.map((k) => String(r[k]).padStart(k.length > 8 ? 8 : 7)).join(' ')}`;
  console.log(`\n${'State'.padEnd(6)} ${'Kind'.padEnd(8)} ${'CountyOnly'.padEnd(11)} ${NUM_KEYS.map((k) => k.padStart(k.length > 8 ? 8 : 7)).join(' ')}`);
  const tot = Object.fromEntries(NUM_KEYS.map((k) => [k, 0])) as Record<(typeof NUM_KEYS)[number], number>;
  for (const { entry: e, report: r } of reports) {
    console.log(row(e.stateCode, r.kind, e.countyOnly ? 'yes' : 'no', r));
    for (const k of NUM_KEYS) tot[k] += r[k];
  }
  console.log(row('TOTAL', '', '', tot));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) { console.log(USAGE); return; }
  const dir = typeof args.dir === 'string' ? args.dir : '';
  if (!dir) { console.log(USAGE); throw new Error('--dir is required'); }
  const commit = args.commit === true;
  const confirmDb = typeof args['confirm-db'] === 'string' ? args['confirm-db'] : undefined;
  const backupArg = typeof args['backup-dir'] === 'string' ? args['backup-dir'] : undefined;
  const reportArg = typeof args['report-dir'] === 'string' ? args['report-dir'] : undefined;
  const reportDir = path.resolve(reportArg ?? backupArg ?? 'import-reports');
  const backupDir = path.resolve(backupArg ?? reportDir);

  validateManifest(MANIFEST);
  console.log(WARNING);

  // Lazy requires keep importing this module side-effect free (tests import checkCommitGuard).
  /* eslint-disable @typescript-eslint/no-var-requires */
  const mongoose = require('mongoose') as typeof import('mongoose');
  const { env } = require('../config/env') as typeof import('../config/env');
  const { CurriculumModel } = require('../modules/curricula/curriculum.model') as typeof import('../modules/curricula/curriculum.model');
  const { CountyAdditionModel } = require('../modules/curricula/county-addition.model') as typeof import('../modules/curricula/county-addition.model');
  /* eslint-enable @typescript-eslint/no-var-requires */

  // Parse everything first so a bad file aborts before any database work.
  const parsed = MANIFEST.map((e) => {
    const full = path.join(dir, e.file);
    if (!fs.existsSync(full)) throw new Error(`Missing source file: ${full}`);
    return { entry: e, full, doc: parseCurriculumDoc(readDocxParagraphs(fs.readFileSync(full))) };
  });

  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    const connectedDb = mongoose.connection.name;
    console.log(`Connected to host: ${mongoose.connection.host} / db: ${connectedDb}`);
    console.log(commit ? 'MODE: COMMIT (writes to the database)' : 'MODE: DRY RUN (no database writes)');

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    let backupPath: string | undefined;
    if (commit) {
      checkCommitGuard({ commit, confirmDb, connectedDb, backupPath: '(pending)' }); // refuse before touching disk
      fs.mkdirSync(backupDir, { recursive: true });
      backupPath = path.join(backupDir, `curricula-backup-${stamp}.json`);
      const backup = {
        takenAt: new Date().toISOString(), database: connectedDb,
        curricula: await CurriculumModel.find({}).lean(),
        countyadditions: await CountyAdditionModel.find({}).lean(),
      };
      fs.writeFileSync(backupPath, JSON.stringify(backup));
      console.log(`Backup written: ${backupPath} (${backup.curricula.length} curricula, ${backup.countyadditions.length} county additions)`);
    }
    checkCommitGuard({ commit, confirmDb, connectedDb, backupPath });

    const reports: { entry: ManifestEntry; report: StateReport }[] = [];
    for (const p of parsed) {
      const report = await applyImport(
        { path: p.full, stateCode: p.entry.stateCode, kind: p.entry.kind, countyOnly: p.entry.countyOnly }, p.doc, { commit },
      );
      reports.push({ entry: p.entry, report });
    }
    printReports(reports);

    fs.mkdirSync(reportDir, { recursive: true });
    const reportPath = path.join(reportDir, `curriculum-import-report-${stamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify({
      database: connectedDb, commit, backupPath,
      reports: reports.map((r) => ({ file: r.entry.file, countyOnly: !!r.entry.countyOnly, ...r.report })),
    }, null, 2));
    console.log(`\nReport written: ${reportPath}`);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('FAILED:', err.message);
    process.exit(1);
  });
}
