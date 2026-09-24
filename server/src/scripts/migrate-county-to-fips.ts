/**
 * One-off migration: backfill country/state/countyFips on courses and student
 * profiles that only have the legacy free-text `county`.
 *
 * Dry run by default — prints what it would change. Pass --apply to write.
 * Pass --state=XX to disambiguate names that exist in several states
 * (e.g. "Washington County") when all legacy data is from one state.
 *
 * Usage: npx ts-node src/scripts/migrate-county-to-fips.ts [--apply] [--state=VA]
 *
 * Records that can't be resolved are listed and left untouched; fix them by hand
 * in the curriculum editor (courses) or ask the student to re-pick in Profile.
 */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { resolveLegacyCounty } from './resolve-legacy-county';

const apply = process.argv.includes('--apply');
const stateArg = process.argv.find((a) => a.startsWith('--state='))?.split('=')[1];

// Raw collections, not models: the Course schema now requires countyFips,
// so legacy documents would fail model validation.
const TARGETS = [
  { collection: 'courses', label: 'course' },
  { collection: 'studentprofiles', label: 'student' },
] as const;

async function migrate(collection: string, label: string) {
  const col = mongoose.connection.collection(collection);
  const legacy = col.find({
    county: { $type: 'string', $ne: '' },
    $or: [{ countyFips: { $exists: false } }, { countyFips: null }, { countyFips: '' }],
  });

  let resolved = 0;
  const problems: string[] = [];

  for await (const doc of legacy) {
    const r = resolveLegacyCounty(doc.county, stateArg);
    if (r.status !== 'resolved') {
      const detail =
        r.status === 'ambiguous' ? `ambiguous: ${r.candidates.map((c) => c.state).join(', ')}` : 'no match';
      problems.push(`  ${label} ${doc._id}  "${doc.county}"  (${detail})`);
      continue;
    }
    resolved++;
    const { fips, name, state } = r.county;
    console.log(`  ${label} ${doc._id}  "${doc.county}" → ${name}, ${state} (${fips})`);
    if (apply) {
      await col.updateOne({ _id: doc._id }, { $set: { country: 'US', state, countyFips: fips, county: name } });
    }
  }

  console.log(`${collection}: ${resolved} ${apply ? 'updated' : 'would update'}, ${problems.length} unresolved`);
  if (problems.length) console.log(problems.join('\n'));
  return problems.length;
}

async function main() {
  await connectDatabase();
  console.log(apply ? 'APPLYING changes' : 'DRY RUN (pass --apply to write)');
  let unresolved = 0;
  for (const t of TARGETS) unresolved += await migrate(t.collection, t.label);
  await disconnectDatabase();
  process.exit(unresolved ? 2 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
